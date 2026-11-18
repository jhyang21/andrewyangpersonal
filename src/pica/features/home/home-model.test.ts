import { describe, expect, it, vi } from "vitest";
import { createSession, sessionReducer } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { NO_FACTS } from "@/pica/features/saved/saved-card-model";
import { CATEGORY_LINKS, EXAMPLES, chipTap, homePose, openerFor, resumeCard, sendGate } from "./home-model";

function plain(id: string, updatedAt: number): DecisionSession {
  return { ...createSession({ id, at: 1, title: `Decision ${id}` }), updatedAt };
}

function byId(...list: DecisionSession[]): Record<string, DecisionSession> {
  return Object.fromEntries(list.map((s) => [s.id, s]));
}

/** Whether a promise has settled, after pending callbacks run. */
async function settled(promise: Promise<void>): Promise<boolean> {
  let done = false;
  void promise.then(() => {
    done = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  return done;
}

describe("openerFor", () => {
  it("counts a send of a chip's exact words as that example, with its category", () => {
    for (const example of EXAMPLES) {
      expect(openerFor(example.text)).toEqual({ text: example.text, source: "example", category: example.category });
    }
  });

  it("counts anything else as the buyer's own words from Home, with no category", () => {
    expect(openerFor("A bag for the gym")).toEqual({ text: "A bag for the gym", source: "home" });
    // An edited example is the buyer's own.
    expect(openerFor(`${EXAMPLES[0].text} and a laptop`).source).toBe("home");
  });

  it("offers the brief's three examples and three category links", () => {
    expect(EXAMPLES.map((e) => e.text)).toEqual([
      "My shoulder no longer aches after the commute",
      "Two weeks in Japan without checking a bag",
      "I go from the office to dinner with one bag",
    ]);
    expect(CATEGORY_LINKS.map((l) => l.label)).toEqual(["Bags", "Backpacks", "Luggage"]);
  });
});

describe("chipTap", () => {
  const [first, second] = EXAMPLES.map((e) => e.text);

  it("fills an empty box", () => {
    expect(chipTap("", first)).toEqual({ kind: "fill", text: first });
    expect(chipTap("  \n", first)).toEqual({ kind: "fill", text: first });
  });

  it("swaps one example's words for another's, spaces round them aside", () => {
    expect(chipTap(second, first)).toEqual({ kind: "fill", text: first });
    expect(chipTap(` ${second} `, first)).toEqual({ kind: "fill", text: first });
  });

  it("never replaces what the buyer typed, an edited example included", () => {
    expect(chipTap("A bag for the gym", first)).toEqual({ kind: "focus" });
    expect(chipTap(`${second} in black`, first)).toEqual({ kind: "focus" });
  });

  it("only focuses when the box already holds these words", () => {
    expect(chipTap(first, first)).toEqual({ kind: "focus" });
  });
});

describe("sendGate", () => {
  it("starts the decision once, with what the send counts as", () => {
    const start = vi.fn();
    void sendGate().send(EXAMPLES[1].text, start);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith({ text: EXAMPLES[1].text, source: "example", category: "luggage" });
  });

  it("holds the send while the decision opens, and lets it go when busy clears", async () => {
    const gate = sendGate();
    const sending = gate.send("A bag for the gym", vi.fn());
    gate.busyChanged(true);
    expect(await settled(sending)).toBe(false);
    gate.busyChanged(false);
    expect(await settled(sending)).toBe(true);
  });

  it("lets the send go when the page hides", async () => {
    const gate = sendGate();
    const sending = gate.send("A bag for the gym", vi.fn());
    gate.hide();
    expect(await settled(sending)).toBe(true);
  });

  it("does nothing when no send is held, or when let go twice", async () => {
    const gate = sendGate();
    expect(() => gate.hide()).not.toThrow();
    const sending = gate.send("A bag", vi.fn());
    gate.hide();
    gate.busyChanged(false);
    expect(await settled(sending)).toBe(true);
  });
});

describe("homePose", () => {
  it("is idle with an empty box and listening once there is text", () => {
    expect(homePose("")).toBe("idle");
    expect(homePose("   ")).toBe("idle");
    expect(homePose("a")).toBe("listening");
  });
});

describe("resumeCard", () => {
  it("is null with no open decision", () => {
    expect(resumeCard({})).toBeNull();
    const saved = sessionReducer(plain("s", 5), { type: "decided", status: "saved", at: 6 });
    expect(resumeCard(byId(saved))).toBeNull();
  });

  it("picks the newest open decision and counts the other open ones", () => {
    const declined = { ...sessionReducer(plain("x", 1), { type: "decided", status: "declined", at: 2 }), updatedAt: 99 };
    const card = resumeCard(byId(plain("a", 10), plain("b", 30), plain("c", 20), declined));
    expect(card).toEqual({ title: "Decision b", facts: NO_FACTS, href: "/projects/pica/d/b", others: 2 });
  });

  it("has no others when one decision is open", () => {
    expect(resumeCard(byId(plain("a", 10)))?.others).toBe(0);
  });
});
