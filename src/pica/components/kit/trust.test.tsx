import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EVIDENCE_KINDS, EvidenceTag, evidenceHeading, evidenceLabel } from "./EvidenceTag";
import { SourceTag, sourceLabel } from "./SourceTag";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("EvidenceTag", () => {
  it("has the four kinds with the brief's words and icons", () => {
    const expected = {
      merchant: ["Merchant says", "lucide-store"],
      catalog_summary: ["From the listing", "lucide-file-text"],
      inference: ["Pica&#x27;s read", "lucide-feather"],
      missing: ["Not verified", "lucide-circle-dashed"],
    } as const;
    expect(EVIDENCE_KINDS).toEqual(["merchant", "catalog_summary", "inference", "missing"]);
    for (const basis of EVIDENCE_KINDS) {
      const out = html(<EvidenceTag basis={basis} />);
      const [words, icon] = expected[basis];
      expect(out).toContain(`<span>${words}</span>`);
      expect(out).toContain(icon);
      expect(out).toMatch(/^<span /);
    }
  });

  it("the listing's sheet heading spells out who summarized it", () => {
    expect(evidenceLabel("catalog_summary")).toBe("From the listing");
    expect(evidenceHeading("catalog_summary")).toBe("From the listing, summarized by Shopify");
    expect(evidenceHeading("merchant")).toBe("Merchant says");
  });

  it("only Not verified has the dashed outline", () => {
    expect(html(<EvidenceTag basis="missing" />)).toContain("border-dashed");
    expect(html(<EvidenceTag basis="inference" />)).not.toContain("border-dashed");
  });

  it("with a quote behind it, the tag is a button that opens it, with a 44px hit area", () => {
    const closed = html(<EvidenceTag basis="merchant" onToggle={() => undefined} controls="q1" />);
    expect(closed).toMatch(/^<button type="button" aria-expanded="false" aria-controls="q1"/);
    expect(closed).toContain("before:-inset-y-2.5");
    expect(closed).not.toContain("role=");
    const open = html(<EvidenceTag basis="merchant" onToggle={() => undefined} expanded controls="q1" />);
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain("rotate-180");
  });
});

describe("SourceTag", () => {
  it("has two kinds: You said and Pica's guess, the guess dashed", () => {
    expect(sourceLabel("stated")).toBe("You said");
    expect(sourceLabel("inferred")).toBe("Pica's guess");
    const stated = html(<SourceTag source="stated" />);
    expect(stated).toContain("lucide-user-round");
    expect(stated).not.toContain("border-dashed");
    const guess = html(<SourceTag source="inferred" />);
    expect(guess).toContain("Pica&#x27;s guess");
    expect(guess).toContain("border-dashed");
  });
});
