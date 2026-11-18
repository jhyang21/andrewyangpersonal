import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import type { DecisionSession } from "@/pica/lib/types";
import { ErrorNotice, ErrorNoticeView, ErrorStateView, trackOnce } from "./ErrorNotice";
import { RETURN_CHECK, ReturnCheckView, returnCheckText } from "./ReturnCheck";
import { STALE_BANNER, StaleBanner } from "./StaleBanner";
import { STORAGE_NOTICE, StorageNoticeView } from "./StorageNotice";

const noop = () => undefined;
const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const session = seedDecision(Date.UTC(2026, 10, 17, 14, 0));

/** No button or link carries a role: the role sits on the notice around them. */
function expectNoRoleOnControls(out: string) {
  expect(out).not.toMatch(/<(button|a)\b[^>]*\brole=/);
}

describe("trackOnce: one error_shown per error", () => {
  it("sends once when strict mode runs the effect twice, and again for a new failure or a new code", () => {
    let sends = 0;
    const send = () => sends++;
    const first = { current: null };
    trackOnce(first, "network:chat:s1", send);
    trackOnce(first, "network:chat:s1", send);
    expect(sends).toBe(1);
    // "Try again" failed: the error left and came back, a new notice with a new ref.
    trackOnce({ current: null }, "network:chat:s1", send);
    expect(sends).toBe(2);
    trackOnce(first, "rate_limited:chat:s1", send);
    expect(sends).toBe(3);
  });
});

describe("ErrorNotice", () => {
  const serverWords = "Pica can't reach the catalog right now. Try again in a minute.";

  it("shows the server's words as sent, with Try again when it may work", () => {
    const out = html(<ErrorNoticeView error={{ code: "catalog_unavailable", message: serverWords }} onRetry={noop} />);
    expect(out).toContain("Pica can&#x27;t reach the catalog right now. Try again in a minute.");
    expect(out).toMatch(/^<div[^>]*role="alert"/);
    expect(out).toContain(">Try again<");
    expectNoRoleOnControls(out);
  });

  it("leaves out Try again when it would not help, or when no handler is given", () => {
    const missing = html(<ErrorNoticeView error={{ code: "not_found", message: "That product is gone." }} onRetry={noop} />);
    expect(missing).toContain("That product is gone.");
    expect(missing).not.toContain("Try again");
    const noHandler = html(<ErrorNoticeView error={{ code: "unknown", message: "Something stopped." }} />);
    expect(noHandler).not.toContain("<button");
  });

  it("makes a wait a status line, not an alert", () => {
    const out = html(<ErrorNoticeView error={{ code: "rate_limited", message: "Pica is busy. Wait a moment." }} onRetry={noop} />);
    expect(out).toMatch(/^<div[^>]*role="status"/);
    expect(out).not.toContain('role="alert"');
    expectNoRoleOnControls(out);
  });

  it("renders the same banner with tracking on (the event fires after mount, not on the server)", () => {
    const error = { code: "unknown" as const, message: "Something stopped." };
    expect(html(<ErrorNotice error={error} where="chat" />)).toBe(html(<ErrorNoticeView error={error} />));
  });
});

describe("ErrorStateView", () => {
  it("wraps the whole state in one alert, with a plain link out", () => {
    const out = html(
      <ErrorStateView
        title="This decision isn't here"
        description="It was saved in another browser, or cleared."
        action={{ label: "Go to Saved", href: "/projects/pica/saved" }}
        headingLevel="h3"
      />,
    );
    expect(out.match(/role="alert"/g)).toHaveLength(1);
    expect(out).toContain(">This decision isn&#x27;t here</h3>");
    expect(out).toContain('href="/projects/pica/saved"');
    expectNoRoleOnControls(out);
  });
});

describe("StaleBanner", () => {
  const stale: DecisionSession = { ...session, shortlist: { ...session.shortlist!, stale: true } };

  it("hides while the shortlist matches the needs", () => {
    expect(html(<StaleBanner session={session} busy={false} onSend={noop} />)).toBe("");
  });

  it("asks to update once the needs change, and hides the action while Pica replies", () => {
    const idle = html(<StaleBanner session={stale} busy={false} onSend={noop} />);
    expect(idle).toContain(STALE_BANNER.title);
    expect(idle).toContain("These options and any comparison reflect your earlier needs.");
    expect(idle).toContain(`>${STALE_BANNER.action}<`);
    expect(idle).toMatch(/^<div[^>]*role="status"/);
    expectNoRoleOnControls(idle);
    const busy = html(<StaleBanner session={stale} busy onSend={noop} />);
    expect(busy).toContain(STALE_BANNER.title);
    expect(busy).not.toContain(STALE_BANNER.action);
  });
});

describe("StorageNoticeView", () => {
  it("says what happened for each cause, and offers Saved only when space ran out", () => {
    const blocked = html(<StorageNoticeView problem="blocked" />);
    expect(blocked).toContain("Changes aren&#x27;t being saved");
    expect(blocked).toContain("blocking storage for this site");
    expect(blocked).not.toContain("<a");
    const full = html(<StorageNoticeView problem="full" />);
    expect(full).toContain(STORAGE_NOTICE.full);
    expect(full).toContain('href="/projects/pica/saved"');
    expectNoRoleOnControls(full);
  });
});

describe("ReturnCheckView", () => {
  it("names the shop and product, says Pica can't see orders, and gives two equal answers", () => {
    const out = html(
      <ReturnCheckView merchant="North Trail Supply" productTitle="Commuter Pack 24L" onBought={noop} onNotYet={noop} />,
    );
    expect(out).toContain(">Did you buy it?</h2>");
    expect(out).toContain("You went to North Trail Supply to check out for the Commuter Pack 24L.");
    expect(out).toContain("Pica can&#x27;t see orders");
    const buttons = [...out.matchAll(/<button[^>]*class="([^"]*)"[^>]*>(?:<[^>]+>)*([^<]+)</g)];
    expect(buttons.map((m) => m[2])).toEqual([RETURN_CHECK.yes, RETURN_CHECK.notYet]);
    expect(buttons[0][1]).toBe(buttons[1][1]);
  });

  it("reads plainly when the product is gone, and takes the heading level it is given", () => {
    expect(returnCheckText(null, null)).toBe(
      "You went to the merchant to check out. Pica can't see orders, so your answer is all it has.",
    );
    const out = html(<ReturnCheckView merchant={null} productTitle={null} onBought={noop} onNotYet={noop} headingLevel="h1" />);
    expect(out).toContain(">Did you buy it?</h1>");
  });
});
