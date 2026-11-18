/**
 * The live chat transport sends the tab's key in its header, read fresh at
 * each send, and sends no header when the tab holds no key. A stubbed fetch
 * and sessionStorage stand in for the browser; only obvious fake keys.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPENAI_KEY_HEADER } from "@/pica/lib/pica/constants";
import { forgetVisitorKey, saveVisitorKey } from "@/pica/features/shared/visitor-key";
import { liveChatTransport } from "./usePicaChat";

const FAKE_KEY = "sk-test-not-real-0000000000";
const OTHER_FAKE_KEY = "sk-test-not-real-1111111111";

const fetchMock = vi.fn<typeof fetch>();

function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (name) => entries.get(name) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (name) => void entries.delete(name),
    setItem: (name, value) => void entries.set(name, String(value)),
  };
}

/** Send once and return the headers the request went out with. */
async function sentHeaders(): Promise<Headers> {
  fetchMock.mockClear();
  const transport = liveChatTransport("live-transport-test");
  await transport
    .sendMessages({
      chatId: "live-transport-test",
      messages: [],
      trigger: "submit-message",
      messageId: undefined,
      abortSignal: undefined,
    })
    .catch(() => {});
  expect(fetchMock).toHaveBeenCalledTimes(1);
  return new Headers(fetchMock.mock.calls[0][1]?.headers);
}

beforeEach(() => {
  vi.stubGlobal("sessionStorage", memoryStorage());
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response("", { status: 500 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("liveChatTransport", () => {
  it("sends no key header when the tab holds no key", async () => {
    const headers = await sentHeaders();
    expect(headers.has(OPENAI_KEY_HEADER)).toBe(false);
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("sends the tab's key in its header, read fresh at each send", async () => {
    saveVisitorKey(FAKE_KEY);
    expect((await sentHeaders()).get(OPENAI_KEY_HEADER)).toBe(FAKE_KEY);

    saveVisitorKey(OTHER_FAKE_KEY);
    expect((await sentHeaders()).get(OPENAI_KEY_HEADER)).toBe(OTHER_FAKE_KEY);

    forgetVisitorKey();
    expect((await sentHeaders()).has(OPENAI_KEY_HEADER)).toBe(false);
  });

  it("keeps the key out of the request body", async () => {
    saveVisitorKey(FAKE_KEY);
    await sentHeaders();
    expect(String(fetchMock.mock.calls[0][1]?.body)).not.toContain(FAKE_KEY);
  });
});
