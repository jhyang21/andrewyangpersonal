import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import type { CatalogProduct } from "@/pica/lib/types";
import { DECLINE_REASONS } from "@/pica/features/decision/actions";
import { DeclineReasons } from "./DeclineReasons";
import { EndDecisionSheet } from "./EndDecisionSheet";
import { EvidenceSheet, EvidenceSheetView } from "./EvidenceSheet";

const noop = () => undefined;
const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const session = seedDecision(Date.UTC(2026, 10, 17, 14, 0));
const [commuterId, , slimId, travelId] = session.shortlist!.entries.map((entry) => entry.productId);
const entryOf = (id: string) => session.shortlist!.entries.find((entry) => entry.productId === id)!;

describe("EvidenceSheet", () => {
  it("renders no content while closed", () => {
    const out = html(<EvidenceSheet sessionId={session.id} product={null} entry={null} onClose={noop} />);
    expect(out).toMatch(/^<dialog/);
    expect(out).not.toContain("Merchant says");
  });

  it("puts its id on the dialog, open or closed", () => {
    const closed = html(<EvidenceSheet id="ev" sessionId={session.id} product={null} entry={null} onClose={noop} />);
    expect(closed).toMatch(/^<dialog[^>]* id="ev"/);
    const product = session.products[commuterId];
    const open = html(<EvidenceSheetView id="ev" product={product} entry={entryOf(commuterId)} onClose={noop} />);
    expect(open).toMatch(/^<dialog[^>]* id="ev"/);
  });

  it("lists the sections in the brief's order, each kind with its words", () => {
    const product = session.products[commuterId];
    const out = html(<EvidenceSheetView product={product} entry={entryOf(commuterId)} onClose={noop} />);
    expect(out).toContain("Where this comes from");
    expect(out).toContain("Commuter Pack 24L from North Trail Supply");
    const order = [
      "Merchant says",
      "From the listing, summarized by Shopify",
      "Rating",
      "Pica&#x27;s read",
      "Not verified",
      "Look for independent reviews",
    ].map((heading) => out.indexOf(`>${heading}</h3>`));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(out).toContain("From the catalog");
    expect(out).toContain("Why it fits you");
    expect(out).toContain("Why you might not want it");
    expect(out).toContain("How the straps feel after 30 minutes.");
    expect(out).toContain("These links open other sites. Pica does not check what they say.");
    expect(out.match(/\(opens in a new tab\)/g)).toHaveLength(3);
  });

  it("says plainly what is missing", () => {
    const slim = session.products[slimId];
    const bare: CatalogProduct = { ...slim, descriptionText: "  ", summarized: { sellingPoints: [], features: [], specs: [] } };
    const out = html(<EvidenceSheetView product={bare} entry={{ ...entryOf(slimId), unverified: [] }} onClose={noop} />);
    expect(out).toContain("The merchant gives no description.");
    expect(out).toContain("Shopify has no summary for this listing.");
    expect(out).toContain("The catalog has no rating for this product.");
    expect(out).toContain("Pica listed nothing here. That does not mean every claim was checked.");
  });

  it("notes few reviews, links the listing, and leaves out Pica's read for a product off the shortlist", () => {
    const travel = session.products[travelId];
    const listed: CatalogProduct = {
      ...travel,
      variants: travel.variants.map((variant) => ({ ...variant, url: "https://north-trail.example/travel" })),
    };
    const out = html(<EvidenceSheetView product={listed} entry={null} onClose={noop} />);
    expect(out).toContain("Few reviews so far");
    expect(out).toContain('href="https://north-trail.example/travel"');
    expect(out).toContain("See it on North Trail Supply");
    expect(out).not.toContain(">Pica&#x27;s read</h3>");
  });
});

describe("EndDecisionSheet", () => {
  it("asks once, with two buttons of one size and no reasons", () => {
    const out = html(<EndDecisionSheet open onClose={noop} onConfirm={noop} id="end-sheet" />);
    expect(out).toContain('id="end-sheet"');
    expect(out).toContain("End this decision without buying?");
    expect(out).toContain("You can reopen it later from Saved.");
    const buttons = [...out.matchAll(/<button[^>]*class="([^"]*)"[^>]*><span[^>]*>(End without buying|Keep deciding)<\/span>/g)];
    expect(buttons.map((m) => m[2])).toEqual(["End without buying", "Keep deciding"]);
    for (const [, classes] of buttons) {
      expect(classes.split(" ")).toContain("w-full");
      expect(classes.split(" ")).toContain("min-h-12");
    }
    expect(out).not.toContain("Why not");
  });
});

describe("DeclineReasons", () => {
  it("shows the six stored reasons as toggles under an optional heading", () => {
    const out = html(<DeclineReasons current="not_now" onPick={noop} />);
    expect(out).toContain("Why not? (optional)");
    expect(out).toMatch(/<h2 id="([^"]+)"[^>]*>.*role="group" aria-labelledby="\1"/);
    for (const reason of DECLINE_REASONS) expect(out).toContain(reason.label.replace("'", "&#x27;"));
    expect(out.match(/aria-pressed="false"/g)).toHaveLength(5);
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(1);
  });
});
