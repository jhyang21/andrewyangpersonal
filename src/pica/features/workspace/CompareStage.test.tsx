import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { previewWorkspace } from "@/app/projects/pica/kit/stages/preview-workspace";
import { FOUR_COMPARED as fourCompared, SEED as seed } from "@/app/projects/pica/kit/stages/stage-states";
import type { DecisionSession } from "@/pica/lib/types";
import { CompareStage } from "./CompareStage";
import type { StageWorkspace } from "./stage-workspace";

const allIds = seed.shortlist!.entries.map((entry) => entry.productId);
const html = (session: DecisionSession, over: Partial<StageWorkspace> = {}) =>
  renderToStaticMarkup(<CompareStage ws={previewWorkspace(session, over)} active={false} />);

describe("CompareStage", () => {
  const out = html(seed);

  it("shows the picks as toggles with the limits in words, and no ask while they match the current table", () => {
    expect(out).toContain(">Compare</h2>");
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(3);
    expect(out.match(/aria-pressed="false"/g)).toHaveLength(1);
    expect(out).toContain("3 picked to compare. You can pick up to 5.");
    expect(out).not.toContain("Compare these");
    expect(out).not.toContain("Update comparison");
  });

  it("shows the stage's ask when there is no table yet", () => {
    const none = html({ ...seed, comparison: null }, { picks: seed.comparison!.productIds });
    expect(none.match(/Compare these 3/g)).toHaveLength(1);
  });

  it("lets a pick's title break inside a long word, so large text never pushes the page sideways", () => {
    const titles = out.match(/<span class="min-w-0 wrap-anywhere"><span class="sr-only">Compare <\/span>/g);
    expect(titles).toHaveLength(4);
  });

  it("leaves the needs to the summary strip: no editor and no open questions here", () => {
    expect(out).not.toContain("What matters to you");
    expect(out).not.toContain("Add a must-have");
    expect(out).not.toContain("<form");
    expect(out).not.toContain("Still open in your needs");
    expect(out).not.toContain("Do you carry a water bottle every day?");
  });

  it("draws a real table with column and row headers, catalog rows first", () => {
    expect(out).toContain("<caption");
    expect(out.match(/<th scope="col"/g)).toHaveLength(3);
    expect(out.match(/<th scope="rowgroup"/g)).toHaveLength(2);
    const table = out.slice(out.indexOf("<table"), out.indexOf("</table>"));
    expect(table.indexOf("From the catalog")).toBeLessThan(table.indexOf("Fits a 16-inch laptop"));
    expect(table).toContain(">Price</th>");
    expect(table).toContain(">Stock</th>");
    expect(table).toContain(">Rating</th>");
  });

  it("shows the table only where each column has 160px, and stacked cards below that", () => {
    expect(out).toContain('class="hidden @min-[608px]:block"');
    expect(out).toContain('class="@min-[608px]:hidden"');
    expect(html(fourCompared, { picks: allIds })).toContain('class="hidden @min-[768px]:block"');
  });

  it("tags Pica's cells, and opens a checked quote beneath its cell", () => {
    expect(out).toContain("Merchant says");
    expect(out).toContain("Pica&#x27;s read");
    expect(out).toContain("Not verified");
    expect(out).toMatch(/<div id="compare-table-quote-0-[^"]+" hidden=""/);
    expect(out).toContain("fits laptops up to 16 inches");
  });

  it("ends each column with the evidence and Choose, off only for the option sold out everywhere", () => {
    expect(out.match(/>See the evidence</g)).toHaveLength(6);
    expect(out).not.toContain('aria-controls="ev"');
    const withSheet = renderToStaticMarkup(<CompareStage ws={previewWorkspace(seed)} active={false} evidenceSheetId="ev" />);
    expect(withSheet.match(/aria-controls="ev"/g)).toHaveLength(6);
    expect(out.match(/<a aria-disabled="true"/g)).toHaveLength(2);
  });

  it("puts Pica's tradeoff before the table, then the way out last", () => {
    const takeaway = out.indexOf("The main tradeoff");
    const table = out.indexOf("<table");
    const end = out.indexOf('aria-controls="compare-end"');
    expect(takeaway).toBeGreaterThan(0);
    expect(takeaway).toBeLessThan(table);
    expect(table).toBeLessThan(end);
    expect(out).toContain('<dialog id="compare-end"');
  });

  it("marks a comparison of other options in fixed words, leaving the count to the picks line", () => {
    const changed = html(seed, { picks: allIds });
    expect(changed).toContain("This comparison covers different options");
    expect(changed).toContain("Pick 2 to 5 options above and compare them to replace this one.");
    expect(changed.match(/Compare these 4/g)).toHaveLength(1);
    expect(changed.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Compare these 4/g)).toHaveLength(1);
    expect(changed).not.toContain("Update comparison");
  });

  it("shows one caution at most: different picks win over changed needs", () => {
    const both = html({ ...seed, comparison: { ...seed.comparison!, stale: true } }, { picks: allIds });
    expect(both).toContain("This comparison covers different options");
    expect(both).not.toContain("This comparison reflects your earlier needs");
    expect(both.match(/<div role="status"/g)).toHaveLength(1);
  });

  it("keeps the comparison heading as a focus target for when a banner goes", () => {
    expect(out).toMatch(/<h3 id="compare-table-heading" tabindex="-1"/i);
    expect(out).toMatch(/<h2 id="compare-title" tabindex="-1"/i);
  });

  it("marks a comparison made on earlier needs, with one Update action that hides while Pica replies", () => {
    const stale = { ...seed, comparison: { ...seed.comparison!, stale: true } };
    const idle = html(stale);
    expect(idle).toContain("This comparison reflects your earlier needs");
    expect(idle.match(/>Update comparison</g)).toHaveLength(1);
    expect(idle).not.toContain("Compare these");
    const busy = html(stale, { busy: true, picksLocked: true });
    expect(busy).toContain("This comparison reflects your earlier needs");
    expect(busy).not.toContain("Update comparison");
    expect(busy).toContain("You can change your picks once Pica has replied.");
  });

  it("leaves the shortlist's banner to Options", () => {
    const stale = { ...seed, shortlist: { ...seed.shortlist!, stale: true } };
    expect(html(stale)).not.toContain("Your needs changed after this shortlist");
  });

  it("says when there is no comparison yet, and when there is nothing to compare", () => {
    const none = html({ ...seed, comparison: null }, { picks: [] });
    expect(none).toContain("No comparison yet");
    expect(none).toContain("Pick 2 to 5 options to compare.");
    expect(none).toContain("Pick 2 to 5 options above, then ask Pica to compare them.");
    expect(none).toContain(">Compare these options<");
    const empty = html({ ...seed, shortlist: null, comparison: null }, { picks: [] });
    expect(empty).toContain("Nothing to compare yet");
    expect(empty).toContain(">Go to chat<");
  });

  it("with one option, says only that there is nothing to compare yet", () => {
    const one = html(
      { ...seed, shortlist: { ...seed.shortlist!, entries: seed.shortlist!.entries.slice(0, 1) }, comparison: null },
      { picks: [] },
    );
    expect(one).toContain("Pica has 1 option so far, so there is nothing to compare yet.");
    expect(one).not.toContain("No comparison yet");
    expect(one).not.toMatch(/Pick 2 to 5 options/);
    expect(one).not.toContain("Pica&#x27;s comparison");
  });

  it("says in its own line when most compared products are gone, not 'No comparison yet'", () => {
    const [a, b] = seed.comparison!.productIds;
    const products = Object.fromEntries(Object.entries(seed.products).filter(([id]) => id !== a && id !== b));
    const lost = html({ ...seed, products }, { picks: [] });
    expect(lost).toContain(
      "<p class=\"break-words text-body text-ink\">Pica&#x27;s comparison cannot show: fewer than 2 of the options it compared are still in your list.</p>",
    );
    expect(lost).toMatch(/<h3 id="compare-table-heading"/);
    expect(lost).not.toContain("No comparison yet");
    expect(lost).not.toContain("<table");
  });

  it("uses only the new kit, mascot and parts, and lays out with CSS", () => {
    for (const file of ["CompareStage.tsx", "ComparisonViews.tsx"]) {
      const code = readFileSync(`src/pica/features/workspace/${file}`, "utf8");
      expect(code).not.toMatch(/@\/components\/(ui|pica)\b|shared\/ErrorNotice/);
      expect(code).not.toMatch(/useWorkspace\(|usePicaChat\(|useMediaQuery/);
    }
  });
});
