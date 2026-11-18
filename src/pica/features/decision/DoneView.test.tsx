import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import type { DecisionSession, DecisionStatus } from "@/pica/lib/types";
import { ConfidenceCheckView } from "./ConfidenceCheck";
import { doneView } from "./done-model";
import { DoneView } from "./DoneView";

const noop = () => undefined;
const base = seedDecision(Date.UTC(2026, 10, 17, 14, 0));
const commuterId = "gid://shopify/p/seed-commuter";

function withStatus(status: DecisionStatus, over: Partial<DecisionSession> = {}): DecisionSession {
  return { ...base, decision: { status, productId: commuterId }, ...over };
}

function render(session: DecisionSession, returnCheck = <p>RETURN CHECK</p>) {
  const done = { ...doneView(session), reason: session.decision.reason, pickReason: noop };
  return renderToStaticMarkup(<DoneView session={session} done={done} returnCheck={returnCheck} />);
}

/** The pose drawn, from the mascot's markup. */
const pose = (out: string) => out.match(/data-pose="(\w+)"/)?.[1];

describe("DoneView", () => {
  it("has one h1, the decision's title, and the outcome as the display h2", () => {
    const out = render(withStatus("bought"));
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(new RegExp(`<h1[^>]*>${base.title}</h1>`));
    expect(out).toMatch(/<h2[^>]*>You bought the Commuter Pack 24L<\/h2>/);
  });

  it("treats bought and not buying alike: same pose, same size, no celebration", () => {
    const bought = render(withStatus("bought"));
    const declined = render(withStatus("declined"));
    expect(pose(bought)).toBe("settled");
    expect(pose(declined)).toBe("settled");
    for (const out of [bought, declined]) {
      expect(out).toContain('width="120"');
      expect(out).toContain("text-display");
      expect(out).not.toMatch(/confetti|congrat/i);
    }
  });

  it("after not buying: the line, then the optional reasons", () => {
    const out = render(withStatus("declined"));
    expect(out).toContain("You decided not to buy");
    expect(out).toContain("Deciding not to buy is a real answer.");
    expect(out).toContain("Why not? (optional)");
    expect(out).toContain("Too expensive for what it is");
    expect(out).not.toContain("Check in later");
  });

  it("after buying: how to check in later, and no reasons", () => {
    const out = render(withStatus("bought"));
    expect(out).toContain("Check in later");
    expect(out).toContain("Pica can&#x27;t see your orders.");
    expect(out).not.toContain("Why not?");
  });

  it("saved rests, with no reasons and no check-in", () => {
    const out = render(withStatus("saved"));
    expect(out).toContain("Saved for later");
    expect(out).not.toContain("Why not?");
    expect(out).not.toContain("Check in later");
    expect(out).toContain("How sure do you feel?");
  });

  it("asks Did you buy it first when checkout started, in place of the outcome", () => {
    const out = render(withStatus("open", { checkoutStartedAt: Date.UTC(2026, 10, 17, 14, 5) }));
    expect(out).toContain("RETURN CHECK");
    expect(out).not.toContain("This decision is still open");
    expect(out).not.toContain("How sure do you feel?");
  });

  it("says an open decision is still open, with no reasons and no confidence check", () => {
    const out = render(withStatus("open"));
    expect(out).toMatch(/<h2[^>]*>This decision is still open<\/h2>/);
    expect(pose(out)).toBe("idle");
    expect(out).not.toContain("Why not?");
    expect(out).not.toContain("How sure do you feel?");
    expect(out).not.toContain("Check in later");
  });

  it("shows only the return card over a declined or saved decision until it is answered", () => {
    for (const status of ["declined", "saved"] as const) {
      const out = render(withStatus(status, { checkoutStartedAt: Date.UTC(2026, 10, 17, 14, 5) }));
      expect(out).toContain("RETURN CHECK");
      expect(out).not.toContain("You decided not to buy");
      expect(out).not.toContain("Saved for later");
      expect(out).not.toContain("Why not?");
      expect(out).not.toContain("How sure do you feel?");
      expect(out).toContain("Start a new decision");
    }
  });

  it("ends with the three links and no Reopen", () => {
    const out = render(withStatus("declined"));
    expect(out).toContain("Start a new decision");
    expect(out).toContain(`href="/projects/pica/d/${base.id}"`);
    expect(out).toContain('href="/projects/pica/saved"');
    expect(out).not.toMatch(/Reopen/);
  });
});

describe("ConfidenceCheckView", () => {
  it("says it is optional, offers Yes and No for each, and announces nothing on load", () => {
    const out = renderToStaticMarkup(
      <ConfidenceCheckView answers={{}} saved={false} savedBefore={false} onAnswer={noop} />,
    );
    expect(out).toContain("Optional.");
    expect(out.match(/<legend/g)).toHaveLength(3);
    expect(out.match(/>Yes</g)).toHaveLength(3);
    expect(out.match(/>No</g)).toHaveLength(3);
    expect(out).not.toContain('aria-pressed="true"');
    // Empty and out of the flow until the answers save, so the card holds no blank gap.
    expect(out).toMatch(/<p role="status" class="sr-only"><\/p>/);
  });

  it("says once, in view, that the answers saved during this visit", () => {
    const out = renderToStaticMarkup(
      <ConfidenceCheckView answers={{}} saved savedBefore={false} onAnswer={noop} />,
    );
    expect(out).toMatch(/<p role="status" class="text-body text-ink">Your answers are saved.<\/p>/);
  });

  it("keeps answers so far, and says plainly when saved on an earlier visit", () => {
    const out = renderToStaticMarkup(
      <ConfidenceCheckView answers={{ understandNeeds: false }} saved savedBefore onAnswer={noop} />,
    );
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(out).toContain("Your answers are saved.");
    expect(out).not.toContain('role="status"');
  });
});
