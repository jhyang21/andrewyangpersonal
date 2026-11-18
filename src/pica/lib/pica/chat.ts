/**
 * The `POST /api/chat` handler. Server-only.
 *
 * Body: `{ messages: PicaUIMessage[], session: ChatSessionContext }`, with the
 * visitor's OpenAI key in the `OPENAI_KEY_HEADER` header. The key serves this
 * request only: it is never stored, logged or sent back.
 * Answers with an AI SDK UI message stream, or `{ error: ApiError }` with a
 * 4xx/5xx status when it can't start.
 */
import {
  APICallError,
  RetryError,
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
import { keyFromRequest, picaProvider } from "./openai-key";
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

/** The OpenAI call failure behind an error: the error itself, or the last try of a retry. */
function apiCallErrorIn(error: unknown): APICallError | null {
  if (APICallError.isInstance(error)) return error;
  if (RetryError.isInstance(error)) return apiCallErrorIn(error.lastError);
  return null;
}

/**
 * Log a failure and pick the buyer's message for it. OpenAI's error message
 * can quote part of the key, so for an OpenAI error the log holds only the
 * status, never the message, the request or its headers.
 */
export function failureText(error: unknown, where: string): string {
  const apiError = apiCallErrorIn(error);
  if (apiError?.statusCode === 401) {
    console.error(`[pica] ${where}: OpenAI refused the key (401)`);
    return PICA_MESSAGES.badKey;
  }
  if (apiError) {
    console.error(`[pica] ${where}: OpenAI answered ${apiError.statusCode ?? "with no status"}`);
  } else {
    console.error(`[pica] ${where}:`, error instanceof Error ? error.message : typeof error);
  }
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
  const openai = picaProvider(keyFromRequest(request));
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
  // The Decisions helper runs on the same key as the chat.
  const decisions = { model: openai.decisionModel(PICA_MODEL_ID) };
  const { tools } = createPicaTools({ session, questionsAsked, allowedAmounts, knownPrices, decisions });

  const lastUser = [...messages].reverse().find((message) => message.role === "user");

  try {
    const [modelMessages, turnRead] = await Promise.all([
      convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
      readTurn(
        {
          latestUserText: lastUser ? textOf(lastUser) : "",
          canvas: session.canvas,
          recentTurns: recentTurns(messages),
        },
        decisions,
      ),
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
      // The UI stream's onError below logs each failure safely. The default
      // here would print the whole error, and OpenAI's message can quote part
      // of the key.
      onError: () => {},
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream<typeof tools, PicaUIMessage>({
        stream: result.stream,
        tools,
        originalMessages: messages,
        onError: (error) => failureText(error, "model stream failed"),
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
    const message = failureText(error, "chat failed to start");
    if (message === PICA_MESSAGES.badKey) return errorResponse(401, { code: "bad_key", message });
    return errorResponse(502, { code: "model_unavailable", message });
  }
}
