/**
 * Route-level test with the AI SDK mock model. No API key and no network:
 * `@ai-sdk/openai` and `@/pica/lib/shopify` are mocked, and the key is a stub.
 */
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchCatalog } from "@/pica/lib/shopify";
import { CHAT_LIMITS, CHAT_RATE_LIMIT, PICA_MESSAGES } from "@/pica/lib/pica/constants";
import { chatRateLimiter } from "@/pica/lib/pica/rate-limit";
import { makeProduct, makeSession } from "@/pica/lib/pica/test-helpers";
import { POST } from "./route";

const holder = vi.hoisted(() => ({ model: null as unknown }));

vi.mock("@ai-sdk/openai", () => {
  const openai = Object.assign(() => holder.model, {
    // The Decisions helper always fails here, so the route must carry on without it.
    decisionModel: () => ({
      specificationVersion: "v4",
      provider: "mock",
      modelId: "mock-decision",
      supportedQuestionTypes: ["choice", "score", "boolean"],
      doDecide: async () => {
        throw new Error("Decisions API down");
      },
    }),
  });
  return { createOpenAI: () => openai };
});

vi.mock("@/pica/lib/shopify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/pica/lib/shopify")>()),
  searchCatalog: vi.fn(),
}));

// The provider's stream part type, read off the mock so we need no extra dependency.
type LanguageModelV4StreamPart =
  Awaited<ReturnType<MockLanguageModelV4["doStream"]>>["stream"] extends ReadableStream<infer P> ? P : never;

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

function streamOf(chunks: LanguageModelV4StreamPart[]) {
  return { stream: simulateReadableStream({ chunks, initialDelayInMs: null, chunkDelayInMs: null }) };
}

const product = makeProduct({ id: "gid://shopify/p/abc" });

function chatRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const userMessage = {
  id: "m1",
  role: "user",
  parts: [{ type: "text", text: "Show me commuter backpacks under 200 dollars" }],
};

beforeEach(() => {
  // Every test calls from the same address; start each with a fresh allowance.
  chatRateLimiter.reset();
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
  vi.mocked(searchCatalog).mockResolvedValue({ products: [product], totalCount: 1, nextCursor: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/chat", () => {
  it("answers 503 missing_key without a key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(chatRequest({ messages: [userMessage], session: makeSession() }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "missing_key", message: PICA_MESSAGES.missingKey },
    });
  });

  it("answers 400 bad_request for a malformed body", async () => {
    const response = await POST(chatRequest({ messages: [userMessage] }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("bad_request");

    const notJson = new Request("http://localhost/api/chat", { method: "POST", body: "{nope" });
    expect((await POST(notJson)).status).toBe(400);
  });

  it("streams a scripted search_catalog call with the full products to the client", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          { type: "stream-start", warnings: [] },
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "search_catalog",
            input: JSON.stringify({ query: "commuter backpack", category: "backpack", maxPriceUsd: 200 }),
          },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
        ]),
        streamOf([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Here's one to start with." },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      ],
    });
    holder.model = model;

    const response = await POST(chatRequest({ messages: [userMessage], session: makeSession() }));
    expect(response.status).toBe(200);
    const body = await response.text();

    // The client gets the tool output with the full catalog record.
    const events = body
      .split("\n")
      .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
      .map((line) => JSON.parse(line.slice(6)));
    const output = events.find((event) => event.type === "tool-output-available");
    expect(output).toBeDefined();
    expect(output.toolCallId).toBe("call-1");
    expect(output.output.products[0]).toEqual(product);
    expect(events.some((e) => e.type === "tool-input-available" && e.toolName === "search_catalog")).toBe(true);
    expect(events.some((e) => e.type === "text-delta" && e.delta === "Here's one to start with.")).toBe(true);

    expect(vi.mocked(searchCatalog)).toHaveBeenCalledWith({
      query: "commuter backpack",
      category: "backpack",
      maxPriceUsd: 200,
      limit: 10,
    });

    // The model's second step sees the digest, not URLs.
    expect(model.doStreamCalls).toHaveLength(2);
    const toolMessage = model.doStreamCalls[1].prompt.find((message) => message.role === "tool");
    const toolResult = JSON.stringify(toolMessage);
    expect(toolResult).toContain("gid://shopify/p/abc");
    expect(toolResult).toContain("Shopify generated this");
    expect(toolResult).not.toMatch(/https?:|cdn\.shopify|cart\/|utm_source|myshopify/);
  });

  it("sends a made-up product ID back to the model as an error, never as a shortlist", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          {
            type: "tool-call",
            toolCallId: "call-s",
            toolName: "present_shortlist",
            input: JSON.stringify({
              entries: [
                {
                  productId: "gid://shopify/p/invented",
                  angle: "The roomy one",
                  whyItFits: ["Holds a lot"],
                  whyNot: ["Heavy"],
                  valueNote: "Costs more than most",
                  unverified: [],
                },
              ],
              note: "One pick.",
            }),
          },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
        ]),
        streamOf([
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Let me search first." },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      ],
    });
    holder.model = model;

    const body = await (await POST(chatRequest({ messages: [userMessage], session: makeSession() }))).text();
    expect(body).toContain('"type":"tool-output-error"');
    expect(body).not.toContain('"type":"tool-output-available"');
    const toolMessage = JSON.stringify(model.doStreamCalls[1].prompt.find((m) => m.role === "tool"));
    expect(toolMessage).toContain("is not a product from the catalog");
  });

  it("ends the turn after ask_question", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          {
            type: "tool-call",
            toolCallId: "call-q",
            toolName: "ask_question",
            input: JSON.stringify({
              question: "Do you carry a laptop?",
              why: "It decides the size.",
              options: ["Yes", "No"],
            }),
          },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
        ]),
      ],
    });
    holder.model = model;

    const response = await POST(chatRequest({ messages: [userMessage], session: makeSession() }));
    const body = await response.text();
    expect(body).toContain('"type":"tool-output-available"');
    expect(body).toContain("Do you carry a laptop?");
    expect(model.doStreamCalls).toHaveLength(1);
  });

  it("gives the model another step when ask_question is rejected", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          {
            type: "tool-call",
            toolCallId: "call-q",
            toolName: "ask_question",
            input: JSON.stringify({
              question: "Do you carry a laptop?",
              why: "So I can find the best one.",
              options: ["Yes", "No"],
            }),
          },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
        ]),
        streamOf([
          {
            type: "tool-call",
            toolCallId: "call-q2",
            toolName: "ask_question",
            input: JSON.stringify({
              question: "Do you carry a laptop?",
              why: "It decides the size.",
              options: ["Yes", "No"],
            }),
          },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
        ]),
      ],
    });
    holder.model = model;

    const body = await (await POST(chatRequest({ messages: [userMessage], session: makeSession() }))).text();
    expect(model.doStreamCalls).toHaveLength(2);
    const toolMessage = JSON.stringify(model.doStreamCalls[1].prompt.find((m) => m.role === "tool"));
    expect(toolMessage).toContain('\\"best\\"');
    // The buyer sees the fixed question, and the turn ends there.
    expect(body).toContain('"type":"tool-output-error"');
    expect(body).toContain('"type":"tool-output-available"');
    expect(body).toContain("It decides the size.");
  });

  it("holds back a reply that states a price or uses a sales word", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "This one is the best, and it's only " },
          { type: "text-delta", id: "t1", delta: "$129." },
          { type: "text-end", id: "t1" },
          { type: "text-start", id: "t2" },
          { type: "text-delta", id: "t2", delta: "Want me to compare them?" },
          { type: "text-end", id: "t2" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      ],
    });
    holder.model = model;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const body = await (await POST(chatRequest({ messages: [userMessage], session: makeSession() }))).text();
    expect(body).not.toContain("$129");
    expect(body).not.toContain("the best");
    expect(body).toContain(PICA_MESSAGES.replyWithheld);
    // A clean block passes as written.
    expect(body).toContain("Want me to compare them?");

    // The log names the rules, never the buyer-facing text.
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain('"best"');
    expect(logged).toContain("a price");
    expect(logged).not.toContain("129");
  });

  it("lets a reply repeat the buyer's budget, but not an amount the buyer never gave", async () => {
    const blocks = [
      "I'll look under $200.00 for you.", // from the buyer's message ("200 dollars")
      "Over your $80 floor.", // from the canvas budget
      "Under $200, this one is $149.", // one allowed, one unknown
    ];
    holder.model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          ...blocks.flatMap((text, i): LanguageModelV4StreamPart[] => [
            { type: "text-start", id: `t${i}` },
            { type: "text-delta", id: `t${i}`, delta: text },
            { type: "text-end", id: `t${i}` },
          ]),
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      ],
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const canvas = { ...makeSession().canvas, budget: { minUsd: 80, source: "stated" as const } };

    const body = await (await POST(chatRequest({ messages: [userMessage], session: makeSession({ canvas }) }))).text();
    expect(body).toContain(blocks[0]);
    expect(body).toContain(blocks[1]);
    expect(body).not.toContain("$149");
    expect(body).toContain(PICA_MESSAGES.replyWithheld);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("lets a reply echo the buyer's plain-number budget, but not an amount the model set in the same request", async () => {
    holder.model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          { type: "text-start", id: "t0" },
          { type: "text-delta", id: "t0", delta: "Got it: around $150 to $200." },
          { type: "text-end", id: "t0" },
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "update_canvas",
            input: JSON.stringify({ budget: { minUsd: 150, maxUsd: 250, source: "stated" } }),
          },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
        ]),
        streamOf([
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "I'll keep it under $250." },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      ],
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const plain = { ...userMessage, parts: [{ type: "text", text: "My budget is between 150 and 200." }] };

    const body = await (await POST(chatRequest({ messages: [plain], session: makeSession() }))).text();
    expect(body).toContain("Got it: around $150 to $200.");
    // The buyer never said 250; the model's own budget doesn't clear it.
    expect(body).not.toContain("$250");
    expect(body).toContain(PICA_MESSAGES.replyWithheld);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("lets a reply echo the buyer's number before update_canvas in the same step", async () => {
    holder.model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          { type: "text-start", id: "t0" },
          { type: "text-delta", id: "t0", delta: "I'll look under your $200 limit." },
          { type: "text-end", id: "t0" },
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "update_canvas",
            input: JSON.stringify({ budget: { maxUsd: 200, source: "stated" } }),
          },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
        ]),
        streamOf([{ type: "finish", finishReason: { unified: "stop", raw: undefined }, usage }]),
      ],
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const said = { ...userMessage, parts: [{ type: "text", text: "My limit is 200" }] };

    const body = await (await POST(chatRequest({ messages: [said], session: makeSession() }))).text();
    expect(body).toContain("I'll look under your $200 limit.");
    expect(warn).not.toHaveBeenCalled();
  });

  it("blocks a bare number that is a session product's price", async () => {
    holder.model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "The slim one is 129. It has a padded sleeve." },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      ],
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = await (await POST(chatRequest({ messages: [userMessage], session: makeSession({ products: [product] }) }))).text();
    expect(body).not.toContain("129");
    expect(body).toContain("It has a padded sleeve.");
    expect(body).toContain(PICA_MESSAGES.replyWithheld);
  });

  it("sends each withheld line once per request, across steps", async () => {
    holder.model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "It's rated 4.6 of 5. Let me look." },
          { type: "text-end", id: "t1" },
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "search_catalog",
            input: JSON.stringify({ query: "commuter backpack" }),
          },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
        ]),
        streamOf([
          { type: "text-start", id: "t2" },
          { type: "text-delta", id: "t2", delta: "It's in stock. Want a comparison?" },
          { type: "text-end", id: "t2" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      ],
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = await (await POST(chatRequest({ messages: [userMessage], session: makeSession() }))).text();
    // Only the text the buyer reads; the search output carries the card's rating.
    const said = body
      .split("\n")
      .filter((line) => line.startsWith("data: {"))
      .map((line) => JSON.parse(line.slice(6)))
      .filter((event) => event.type === "text-delta")
      .map((event) => event.delta)
      .join(" ");
    expect(said.split(PICA_MESSAGES.replyWithheld)).toHaveLength(2);
    expect(said).toContain("Let me look.");
    expect(said).toContain("Want a comparison?");
    expect(said).not.toMatch(/4\.6|in stock/);
  });

  it("never sends the model's reasoning to the client", async () => {
    holder.model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          { type: "reasoning-start", id: "r1" },
          { type: "reasoning-delta", id: "r1", delta: "It costs $129 and is the best." },
          { type: "reasoning-end", id: "r1" },
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Want me to compare them?" },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      ],
    });
    const body = await (await POST(chatRequest({ messages: [userMessage], session: makeSession() }))).text();
    expect(body).toContain("Want me to compare them?");
    expect(body).not.toContain("$129");
    expect(body).not.toContain('"type":"reasoning');
  });

  it("answers 400 with a buyer-facing message when the body is too large or too long", async () => {
    const huge = { ...userMessage, parts: [{ type: "text", text: "x".repeat(CHAT_LIMITS.bodyBytes) }] };
    const tooBig = await POST(chatRequest({ messages: [huge], session: makeSession() }));
    expect(tooBig.status).toBe(400);
    expect(await tooBig.json()).toEqual({ error: { code: "bad_request", message: PICA_MESSAGES.tooLong } });

    const many = Array.from({ length: CHAT_LIMITS.messages + 1 }, (_, i) => ({ ...userMessage, id: `m${i}` }));
    const tooMany = await POST(chatRequest({ messages: many, session: makeSession() }));
    expect(tooMany.status).toBe(400);
    expect((await tooMany.json()).error.message).toBe(PICA_MESSAGES.tooLong);
  });

  it("answers 400 for an over-long canvas string, but cuts an over-long product field", async () => {
    const outcome = { text: "x".repeat(CHAT_LIMITS.canvasTextChars + 1), source: "stated" as const };
    const response = await POST(
      chatRequest({ messages: [userMessage], session: makeSession({ canvas: { ...makeSession().canvas, outcome } }) }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "bad_request", message: PICA_MESSAGES.badRequest } });

    holder.model = new MockLanguageModelV4({
      doStream: [streamOf([{ type: "finish", finishReason: { unified: "stop", raw: undefined }, usage }])],
    });
    const longTitle = makeProduct({ id: "p-long", title: "t".repeat(CHAT_LIMITS.nameChars + 1) });
    const cut = await POST(chatRequest({ messages: [userMessage], session: makeSession({ products: [longTitle] }) }));
    expect(cut.status).toBe(200);
    await cut.text();
  });

  it("answers 400 with its own line for one over-long buyer message", async () => {
    const long = { ...userMessage, parts: [{ type: "text", text: "x".repeat(CHAT_LIMITS.messageChars + 1) }] };
    const response = await POST(chatRequest({ messages: [long], session: makeSession() }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe(PICA_MESSAGES.messageTooLong);
  });

  it("answers 429 rate_limited with a wait time once a client sends too many requests", async () => {
    const fromIp = () =>
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
        body: "{}",
      });
    for (let i = 0; i < CHAT_RATE_LIMIT.requests; i++) {
      expect((await POST(fromIp())).status).toBe(400);
    }
    const limited = await POST(fromIp());
    expect(limited.status).toBe(429);
    const { error } = await limited.json();
    expect(error).toMatchObject({ code: "rate_limited", message: PICA_MESSAGES.rateLimited });
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(CHAT_RATE_LIMIT.windowMs / 1000);
    expect(limited.headers.get("retry-after")).toBe(String(error.retryAfterSeconds));

    // Another client is not affected.
    const other = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.2" },
      body: "{}",
    });
    expect((await POST(other)).status).toBe(400);
  });

  it("removes ask_question once four questions were asked since the last shortlist", async () => {
    const asked = (n: number) => ({
      id: `a${n}`,
      role: "assistant",
      parts: [
        {
          type: "tool-ask_question",
          toolCallId: `q${n}`,
          state: "output-available",
          input: { question: `Q${n}?`, why: "Why.", options: ["A", "B"] },
          output: { question: { question: `Q${n}?`, why: "Why.", options: ["A", "B"] } },
        },
      ],
    });
    const reply = (n: number) => ({ id: `u${n}`, role: "user", parts: [{ type: "text", text: "A" }] });
    const messages = [userMessage, asked(1), reply(1), asked(2), reply(2), asked(3), reply(3), asked(4), reply(4)];

    const model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Let me look." },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      ],
    });
    holder.model = model;

    const response = await POST(chatRequest({ messages, session: makeSession() }));
    await response.text();
    const toolNames = (model.doStreamCalls[0].tools ?? []).map((tool) => ("name" in tool ? tool.name : ""));
    expect(toolNames).toContain("search_catalog");
    expect(toolNames).not.toContain("ask_question");

    // After a shortlist, a canvas edit can lead to a new question.
    const shortlisted = {
      id: "s1",
      role: "assistant",
      parts: [
        {
          type: "tool-present_shortlist",
          toolCallId: "s1",
          state: "output-available",
          input: { entries: [], note: "Two picks." },
          output: { shortlist: { entries: [], note: "Two picks.", createdAt: 1, stale: false } },
        },
      ],
    };
    const edited = { id: "u9", role: "user", parts: [{ type: "text", text: "I changed my budget." }] };
    const after = new MockLanguageModelV4({
      doStream: [
        streamOf([
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Got it." },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      ],
    });
    holder.model = after;
    await (await POST(chatRequest({ messages: [...messages, shortlisted, edited], session: makeSession() }))).text();
    const toolsAfter = (after.doStreamCalls[0].tools ?? []).map((tool) => ("name" in tool ? tool.name : ""));
    expect(toolsAfter).toContain("ask_question");
    const system = JSON.stringify(after.doStreamCalls[0].prompt[0]);
    expect(system).toContain("Questions asked since the last shortlist: 0 of 4");
  });

  it("streams a buyer-facing message when the model fails", async () => {
    holder.model = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error("upstream 500");
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(chatRequest({ messages: [userMessage], session: makeSession() }));
    const body = await response.text();
    expect(body).toContain(PICA_MESSAGES.modelUnavailable);
    expect(body).not.toContain("upstream 500");
  });
});

describe("POST /api/chat: fourth review", () => {
  const events = (body: string) =>
    body
      .split("\n")
      .filter((line) => line.startsWith("data: {"))
      .map((line) => JSON.parse(line.slice(6)));
  const textOf = (body: string) =>
    events(body)
      .filter((event) => event.type === "text-delta")
      .map((event) => event.delta)
      .join(" ");

  it("does not let a budget the model stored in one request clear that price in the next", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = { ...userMessage, parts: [{ type: "text", text: "Show me commuter backpacks" }] };
    // Request N: the model writes the product's price as a stated budget.
    holder.model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "update_canvas",
            input: JSON.stringify({ budget: { maxUsd: 129, source: "stated" } }),
          },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
        ]),
        streamOf([
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Noted." },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      ],
    });
    const session = makeSession({ products: [product] });
    const bodyN = await (await POST(chatRequest({ messages: [first], session }))).text();
    const stored = events(bodyN).find((event) => event.type === "tool-output-available")?.output.canvas;
    expect(stored.budget).toEqual({ maxUsd: 129, source: "inferred" });

    // Request N+1: the client sends that canvas back, and the model names the price.
    holder.model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          { type: "text-start", id: "t2" },
          { type: "text-delta", id: "t2", delta: "It's $129. It has a padded sleeve." },
          { type: "text-end", id: "t2" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      ],
    });
    const history = [
      first,
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "Noted." }] },
      { id: "m2", role: "user", parts: [{ type: "text", text: "How much is it?" }] },
    ];
    const bodyN1 = await (await POST(chatRequest({ messages: history, session: { ...session, canvas: stored } }))).text();
    const said = textOf(bodyN1);
    expect(said).not.toContain("129");
    expect(said).toContain("It has a padded sleeve.");
    expect(said).toContain(PICA_MESSAGES.replyWithheld);
  });

  it("stores a budget the buyer gave as stated", async () => {
    const first = { ...userMessage, parts: [{ type: "text", text: "Under 150 please" }] };
    holder.model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "update_canvas",
            input: JSON.stringify({ budget: { maxUsd: 150, source: "stated" } }),
          },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
        ]),
        streamOf([
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Noted." },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ]),
      ],
    });
    const bodyN = await (await POST(chatRequest({ messages: [first], session: makeSession() }))).text();
    const stored = events(bodyN).find((event) => event.type === "tool-output-available")?.output.canvas;
    expect(stored.budget).toEqual({ maxUsd: 150, source: "stated" });
  });
});
