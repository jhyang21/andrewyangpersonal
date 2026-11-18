import { describe, expect, it } from "vitest";
import { summaryText } from "@/pica/components/kit";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import { EMPTY_CANVAS, type Canvas } from "@/pica/lib/types";
import { summaryStrip } from "./canvas-model";
import type { ChatMessageLike } from "./chat-model";
import { readFileSync } from "node:fs";
import {
  barEntries,
  chatShape,
  closedBanner,
  composerLabel,
  DESKTOP_QUERY,
  composerPlaceholder,
  finishAnnouncement,
  isPlainClick,
  PHONE_FIXED,
  restoredDraft,
  summaryInput,
  takeLoadOpen,
  viewHref,
  viewStep,
  withoutRefused,
} from "./frame-model";

const session = seedDecision(Date.UTC(2026, 10, 17, 14, 0));

describe("viewStep", () => {
  it("does nothing while the address keeps the same value", () => {
    expect(viewStep("options", "options")).toBeNull();
    expect(viewStep(null, null)).toBeNull();
  });

  it("shows the view a new value names, old names included", () => {
    expect(viewStep(null, "options")).toEqual({ kind: "show", view: "options" });
    expect(viewStep("options", "compare")).toEqual({ kind: "show", view: "compare" });
    expect(viewStep("compare", "shortlist")).toEqual({ kind: "show", view: "options" });
    expect(viewStep("options", null)).toEqual({ kind: "show", view: "chat" });
    expect(viewStep("options", "nonsense")).toEqual({ kind: "show", view: "chat" });
  });

  it("opens the needs for the path's Needs link", () => {
    expect(viewStep("chat", "canvas")).toEqual({ kind: "needs" });
  });
});

describe("viewHref", () => {
  it("links each view, and the needs, through ?view=", () => {
    expect(viewHref("d1", "options")).toBe("/projects/pica/d/d1?view=options");
    expect(viewHref("d1", "canvas")).toBe("/projects/pica/d/d1?view=canvas");
  });
});

describe("zones", () => {
  it("puts the whole chat in Chat, docks it in Compare, and splits Options by width", () => {
    expect(chatShape("chat")).toBe("column");
    expect(chatShape("options")).toBe("split");
    expect(chatShape("compare")).toBe("docked");
  });
});

describe("media queries", () => {
  it("are in rem, at Tailwind's lg, so script and CSS switch together", () => {
    expect(DESKTOP_QUERY).toBe("(min-width: 64rem)");
    const hook = readFileSync("src/pica/features/shared/useMediaQuery.ts", "utf8");
    expect(hook).toContain("useSyncExternalStore");
    expect(hook).not.toMatch(/\d+px/);
  });
});

describe("takeLoadOpen", () => {
  it("opens the sheet for a ?view=canvas load once, and never again", () => {
    const flag = { current: true };
    expect(takeLoadOpen(flag)).toBe(true);
    expect(flag.current).toBe(false);
    expect(takeLoadOpen(flag)).toBe(false);
  });

  it("does nothing for any other load", () => {
    expect(takeLoadOpen({ current: false })).toBe(false);
  });
});

describe("PHONE_FIXED", () => {
  it("hides the strip and the dock's title row while typing, below lg only", () => {
    expect(PHONE_FIXED.strip).toContain("max-lg:[html:has(textarea:focus)_&]:sr-only");
    expect(PHONE_FIXED.titleRow).toContain("max-lg:[html:has(textarea:focus)_&]:sr-only");
  });

  it("lets the strip scroll and drops the title row and a line on a screen under 30em high", () => {
    expect(PHONE_FIXED.strip).toContain("sticky");
    expect(PHONE_FIXED.strip).toContain("max-lg:[@media(max-height:29.99em)]:static");
    expect(PHONE_FIXED.titleRow).toContain("max-lg:[@media(max-height:29.99em)]:sr-only");
    expect(PHONE_FIXED.lines).toBe("line-clamp-2 [@media(max-height:29.99em)]:line-clamp-1");
  });
});

describe("composer", () => {
  it("is the chat input in Chat and asks about the options elsewhere", () => {
    expect(composerLabel("chat")).toBe("Message Pica");
    expect(composerLabel("options")).toBe("Ask Pica about these options");
    expect(composerLabel("compare")).toBe("Ask Pica about these options");
  });

  it("invites a typed answer while a question is open", () => {
    expect(composerPlaceholder(true)).toBe("Type your own answer");
    expect(composerPlaceholder(false)).toBe("Ask Pica or add a detail");
  });
});

describe("restoredDraft", () => {
  const said = (role: string, text: string): ChatMessageLike => ({ role, parts: [{ type: "text", text }] });
  const messages = [said("user", "First"), said("assistant", "Sure."), said("user", "A very long message")];

  it("puts the buyer's last words back after a bad request when the composer is empty", () => {
    expect(restoredDraft("bad_request", "", messages)).toBe("A very long message");
    expect(restoredDraft("bad_request", "  ", messages)).toBe("A very long message");
  });

  it("never overwrites what the buyer has typed since", () => {
    expect(restoredDraft("bad_request", "Something new", messages)).toBeNull();
  });

  it("leaves the composer alone for other errors, or with nothing to restore", () => {
    expect(restoredDraft("model_unavailable", "", messages)).toBeNull();
    expect(restoredDraft(undefined, "", messages)).toBeNull();
    expect(restoredDraft("bad_request", "", [said("assistant", "Hi")])).toBeNull();
  });
});

describe("withoutRefused", () => {
  const said = (role: string, text: string): ChatMessageLike => ({ role, parts: [{ type: "text", text }] });

  it("drops the buyer's refused message at the end, so a resend carries it once", () => {
    const messages = [said("user", "First"), said("assistant", "Sure."), said("user", "Too long")];
    expect(withoutRefused(messages)).toEqual(messages.slice(0, 2));
  });

  it("returns the same list when the last message is Pica's, so nothing changes twice", () => {
    const messages = [said("user", "First"), said("assistant", "Sure.")];
    expect(withoutRefused(messages)).toBe(messages);
    const none: ChatMessageLike[] = [];
    expect(withoutRefused(none)).toBe(none);
  });
});

describe("isPlainClick", () => {
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

  it("is a main-button click with no modifier key", () => {
    expect(isPlainClick(click)).toBe(true);
  });

  it("is not a click that may open a new tab or window", () => {
    expect(isPlainClick({ ...click, button: 1 })).toBe(false);
    expect(isPlainClick({ ...click, metaKey: true })).toBe(false);
    expect(isPlainClick({ ...click, ctrlKey: true })).toBe(false);
    expect(isPlainClick({ ...click, shiftKey: true })).toBe(false);
    expect(isPlainClick({ ...click, altKey: true })).toBe(false);
  });
});

describe("finishAnnouncement", () => {
  const reply: ChatMessageLike = { role: "assistant", parts: [{ type: "text", text: "Here you go." }] };
  const ok = { isError: false, isAbort: false, isDisconnect: false };

  it("announces a finished reply", () => {
    expect(finishAnnouncement(reply, ok)).toBe("Pica replied: Here you go.");
  });

  it("says nothing when the reply failed, was stopped or lost its connection", () => {
    expect(finishAnnouncement(reply, { ...ok, isError: true })).toBe("");
    expect(finishAnnouncement(reply, { ...ok, isAbort: true })).toBe("");
    expect(finishAnnouncement(reply, { ...ok, isDisconnect: true })).toBe("");
  });
});

describe("barEntries", () => {
  it("links the three views and counts options and picks", () => {
    const entries = barEntries(session, 2);
    expect(entries.map((entry) => [entry.id, entry.href, entry.label, entry.count])).toEqual([
      ["chat", "/projects/pica/d/seed-decision?view=chat", "Chat", 0],
      ["options", "/projects/pica/d/seed-decision?view=options", "Options", 4],
      ["compare", "/projects/pica/d/seed-decision?view=compare", "Compare", 2],
    ]);
    expect(entries[1].countLabel).toBe("4 options");
    expect(entries[2].countLabel).toBe("2 picked to compare");
  });

  it("counts nothing before a shortlist", () => {
    const fresh = { ...session, shortlist: null };
    expect(barEntries(fresh, 0).map((entry) => entry.count)).toEqual([0, 0, 0]);
  });
});

describe("summaryInput", () => {
  it("gives the kit strip the same words as summaryStrip", () => {
    const canvases: Canvas[] = [
      session.canvas,
      EMPTY_CANVAS,
      { ...EMPTY_CANVAS, budget: { minUsd: 50, source: "inferred" } },
      { ...EMPTY_CANVAS, category: "luggage", budget: { source: "stated" } },
      { ...session.canvas, category: null },
    ];
    for (const canvas of canvases) {
      expect(summaryText(summaryInput(canvas))).toBe(summaryStrip(canvas).text);
    }
  });

  it("reads the seed as its goal, backpacks under $150, with four needs and two guesses", () => {
    expect(summaryInput(session.canvas)).toEqual({ goal: "Get my 16-inch laptop to work and back in comfort", category: "Backpacks", budget: "under $150", needs: 4, toConfirm: 2 });
  });
});

describe("closedBanner", () => {
  it("shows nothing while the decision is open", () => {
    expect(closedBanner("open")).toBeNull();
  });

  it("offers to reopen a saved or declined decision, and a check-in after a purchase", () => {
    expect(closedBanner("saved")?.action).toEqual({ label: "Reopen this decision", reopen: true });
    expect(closedBanner("declined")?.action.reopen).toBe(true);
    expect(closedBanner("bought")?.action).toEqual({ label: "Check in on your purchase", href: "/projects/pica/saved" });
  });
});
