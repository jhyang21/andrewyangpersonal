/**
 * The `POST /api/chat` handler. Server-only.
 *
 * Body: `{ messages: PicaUIMessage[], session: ChatSessionContext }`.
 * Answers with an AI SDK UI message stream, or `{ error: ApiError }` with a
 * 4xx/5xx status when it can't start.
 */
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type StopCondition,
  type ToolSet,
} from "ai";
import { PICA_TOOLS, type ApiError, type Canvas } from "@/pica/lib/types";
import { CHAT_LIMITS, MAX_QUESTIONS, MAX_STEPS, PICA_MESSAGES, PICA_MODEL_ID } from "./constants";
import { parseChatBody, readBodyText } from "./chat-request";
import type { PicaUIMessage } from "./client";
import { readTurn } from "./decisions";
import { picaProvider } from "./openai-key";
import { buildInstructions } from "./prompt";
import { countQuestionsAsked } from "./questions";
import { chatRateLimiter, clientKey } from "./rate-limit";
import { guardReplyText } from "./reply-guard";
import { buyerAmountsIn, createAmountAllowList, createKnownPrices } from "./text-guard";
import { createPicaTools } from "./tools";

const T = PICA_TOOLS;

function errorResponse(status: number, error: ApiError): Response {
  const headers: HeadersInit = error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : {};
  return Response.json({ error }, { status, headers });
}

function textOf(message: PicaUIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
}

function recentTurns(messages: PicaUIMessage[], count = 6): string[] {
  return messages
    .slice(-count - 1, -1)
    .map((message) => `${message.role}: ${textOf(message).slice(0, 300)}`)
    .filter((line) => !line.endsWith(": "));
}

/**
 * Amounts the buyer gave: every number in their own messages, plus the
 * canvas budget sent with the request when the buyer stated it. Pica may
 * echo these ("I'll look under $200"); the guards block any other amount.
 * Nothing the model does in this request adds to the list, and update_canvas
 * stores a budget as "stated" only when its amounts are on the list, so the
 * model can't clear a price by setting it as the budget, now or next request.
 */
function buyerAmounts(messages: PicaUIMessage[], canvas: Canvas): number[] {
  const amounts = messages
    .filter((message) => message.role === "user")
    .flatMap((message) => buyerAmountsIn(textOf(message)));
  const budget = canvas.budget;
  if (budget?.source === "stated") {
    if (budget.minUsd !== undefined) amounts.push(budget.minUsd);
    if (budget.maxUsd !== undefined) amounts.push(budget.maxUsd);
  }
  return amounts;
}

/** Buyer-facing text for a failure after the stream started. */
function streamErrorText(error: unknown): string {
  console.error("[pica] model stream failed:", error instanceof Error ? error.message : error);
  return PICA_MESSAGES.modelUnavailable;
}

/**
 * Stop once the buyer has a question on screen. `hasToolCall` would also stop
 * on a rejected call, which shows nothing; this waits for a real result so
 * the model gets another step to fix its call.
 */
function questionShown<TOOLS extends ToolSet>(): StopCondition<TOOLS> {
  return ({ steps }) =>
    steps[steps.length - 1]?.toolResults.some((result) => result.toolName === T.askQuestion) ?? false;
}

export async function handleChat(request: Request): Promise<Response> {
  const openai = picaProvider();
  if (!openai) {
    return errorResponse(503, { code: "missing_key", message: PICA_MESSAGES.missingKey });
  }

  const limit = chatRateLimiter.check(clientKey(request));
  if (!limit.ok) {
    return errorResponse(429, {
      code: "rate_limited",
      message: PICA_MESSAGES.rateLimited,
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > CHAT_LIMITS.bodyBytes) {
    return errorResponse(400, { code: "bad_request", message: PICA_MESSAGES.tooLong });
  }

  const read = await readBodyText(request, CHAT_LIMITS.bodyBytes);
  if (!read.ok) {
    const message = read.tooLarge ? PICA_MESSAGES.tooLong : PICA_MESSAGES.badRequest;
    return errorResponse(400, { code: "bad_request", message });
  }
  const body = parseChatBody(read.text);
  if (!body.ok) {
    return errorResponse(400, { code: "bad_request", message: body.message });
  }
  const validated = await safeValidateUIMessages<PicaUIMessage>({ messages: body.messages });
  if (!validated.success) {
    return errorResponse(400, { code: "bad_request", message: PICA_MESSAGES.badRequest });
  }

  const messages = validated.data;
  const session = body.session;
  const questionsAsked = countQuestionsAsked(messages);
  const allowedAmounts = createAmountAllowList(buyerAmounts(messages, session.canvas));
  // Shared with the tools, which add the prices of products search finds.
  const knownPrices = createKnownPrices(session.products);
  const { tools } = createPicaTools({ session, questionsAsked, allowedAmounts, knownPrices });

  const lastUser = [...messages].reverse().find((message) => message.role === "user");

  try {
    const [modelMessages, turnRead] = await Promise.all([
      convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
      readTurn({
        latestUserText: lastUser ? textOf(lastUser) : "",
        canvas: session.canvas,
        recentTurns: recentTurns(messages),
      }),
    ]);

    const toolNames = Object.keys(tools) as (keyof typeof tools)[];
    const result = streamText({
      model: openai(PICA_MODEL_ID),
      instructions: buildInstructions({ session, questionsAsked, turnRead }),
      messages: modelMessages,
      tools,
      activeTools:
        questionsAsked >= MAX_QUESTIONS ? toolNames.filter((name) => name !== T.askQuestion) : undefined,
      stopWhen: [questionShown(), isStepCount(MAX_STEPS)],
      experimental_transform: guardReplyText({ allowedAmounts, knownPrices }),
      maxRetries: 1,
      abortSignal: request.signal,
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream<typeof tools, PicaUIMessage>({
        stream: result.stream,
        tools,
        originalMessages: messages,
        onError: streamErrorText,
        // Reasoning is never checked by the reply guard, so it stays on the server.
        sendReasoning: false,
        // Keep tool errors as written: they are notes to the model, and the
        // client hides them. Changing them would change the history. They are
        // safe to send: tools turn any error that isn't one of our checks into
        // a generic line (see runSafely in tools.ts).
        redactToolErrors: false,
      }),
    });
  } catch (error) {
    console.error("[pica] chat failed to start:", error instanceof Error ? error.message : error);
    return errorResponse(502, { code: "model_unavailable", message: PICA_MESSAGES.modelUnavailable });
  }
}
