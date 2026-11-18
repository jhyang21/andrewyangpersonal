import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import { previewWorkspace } from "@/app/projects/pica/kit/stages/preview-workspace";
import type { DecisionSession } from "@/pica/lib/types";
import { OptionsStage } from "./OptionsStage";
import type { StageWorkspace } from "./stage-workspace";

const seed = seedDecision(Date.UTC(2026, 10, 17, 14, 0));
const ws = (session: DecisionSession, over: Partial<StageWorkspace> = {}) =>
  previewWorkspace(session, { picks: [], ...over });

const html = (w: StageWorkspace) => renderToStaticMarkup(<OptionsStage ws={w} active={false} />);

describe("OptionsStage", () => {
  const out = html(ws(seed));

  it("leads with Pica, the count in no order, one source note and Pica's note", () => {
    expect(out).toMatch(/<h2 id="options-title"[^>]*>4 options, in no particular order<\/h2>/);
    expect(out).toContain("Prices, ratings and stock come from the catalog.");
    expect(out).toContain("If your current bag still works, waiting is a fair choice too.");
    // One "Pica's read" tag for the stage, none on the cards.
    expect(out.match(/Pica&#x27;s read/g)).toHaveLength(1);
  });

  it("shows four equal cards, each with both lines, a Compare box, an evidence link and one button", () => {
    expect(out.match(/<article/g)).toHaveLength(4);
    expect(out.match(/>Why it fits you</g)).toHaveLength(4);
    expect(out.match(/>Why you might not want it</g)).toHaveLength(4);
    expect(out.match(/>See the evidence</g)).toHaveLength(4);
    expect(out).not.toContain('aria-controls="ev"');
    const withSheet = renderToStaticMarkup(<OptionsStage ws={ws(seed)} active={false} evidenceSheetId="ev" />);
    expect(withSheet.match(/aria-controls="ev"/g)).toHaveLength(4);
    expect(out.match(/<input type="checkbox"/g)).toHaveLength(4);
    expect(out).not.toContain("checked=");
    expect(out.match(/>Choose this one</g)).toHaveLength(4);
    // No "Checked 2:14 PM" while prices are fresh.
    expect(out).not.toMatch(/>Checked /);
    // Nothing on a card is purple: the primary fill is not used in the stage.
    expect(out).not.toContain("bg-shop-purple");
  });

  it("keeps the rest of each card closed behind More", () => {
    expect(out.match(/aria-expanded="false"/g)).toHaveLength(4);
    expect(out).toContain("Water-resistant nylon covers the rain guess.");
    expect(out).toMatch(/<ul id="option-[^"]+-fits" hidden=""/);
    expect(out).toMatch(/<div id="option-[^"]+-more" hidden=""/);
  });

  it("says each version's stock, and turns Choose off only for the option sold out in every colour", () => {
    expect(out).toContain("Sold out in every size and colour the catalog lists");
    expect(out).toContain("Stock not confirmed");
    expect(out.match(/<a aria-disabled="true"[^>]*>/g)).toHaveLength(1);
    expect(out).toContain('href="/projects/pica/d/seed-decision/decide?product=gid%3A%2F%2Fshopify%2Fp%2Fseed-commuter"');
  });

  it("says the pick limits in words, and ticks picked options", () => {
    const picked = html(ws(seed, { picks: [seed.shortlist!.entries[0].productId] }));
    expect(picked).toContain("1 picked. Pick at least 1 more to compare.");
    expect(picked.match(/<input type="checkbox"[^>]*checked=""/g)).toHaveLength(1);
    expect(out).toMatch(/<p role="status"[^>]*>Pick 2 to 5 options to compare.<\/p>/);
  });

  it("locks the picks while Pica replies, turns None of these fit off with no spinner, and hides the stale action", () => {
    const stale = { ...seed, shortlist: { ...seed.shortlist!, stale: true } };
    const busy = html(ws(stale, { busy: true, picksLocked: true }));
    expect(busy).toContain("You can change your picks once Pica has replied.");
    expect(busy).toContain("Your needs changed after this shortlist");
    expect(busy).not.toContain("Update the options");
    // A reply this button did not start: plainly off, claiming no press.
    // After its own press it shows `loading` instead (see the preview page).
    const noneFit = busy.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*None of these fit/)![0];
    expect(noneFit).toMatch(/\sdisabled=""/);
    expect(noneFit).not.toContain("aria-busy");
    expect(html(ws(stale))).toContain("Update the options");
  });

  it("ends at the foot with two ways out of one size, End asking first in its own sheet", () => {
    expect(out).toContain(">None of these fit<");
    expect(out).toMatch(/aria-controls="options-end"[^>]*>[\s\S]*?End without buying/);
    expect(out).toContain('<dialog id="options-end"');
    const saved = html(ws({ ...seed, decision: { status: "saved" } } as DecisionSession));
    expect(saved).toContain(">None of these fit<");
    expect(saved).toMatch(/aria-controls="options-end"[^>]*>[\s\S]*?End without buying/);
    const done = html(ws({ ...seed, decision: { status: "declined" } }));
    expect(done).not.toContain("End without buying");
  });

  it("renders the same while active", () => {
    const live = renderToStaticMarkup(<OptionsStage ws={ws(seed)} active />);
    expect(live).toContain("4 options, in no particular order");
    expect(live.match(/<article/g)).toHaveLength(4);
  });

  it("says there is nothing to compare with one option", () => {
    const one = { ...seed, shortlist: { ...seed.shortlist!, entries: seed.shortlist!.entries.slice(0, 1) } };
    const page = html(ws(one));
    expect(page).toContain("Pica has 1 option so far, so there is nothing to compare yet.");
    expect(page).not.toContain("Pick 2 to 5");
  });

  it("shows the nothing-yet state with no shortlist", () => {
    const empty = html(ws({ ...seed, shortlist: null }));
    expect(empty).toContain("No options yet");
    expect(empty).toContain("Tell Pica what you need, or ask for products now.");
    expect(empty).toContain(">Go to chat<");
  });

  it("keeps Pica's note and the stale banner when every listed product is missing", () => {
    const missing = { ...seed, products: {}, shortlist: { ...seed.shortlist!, stale: true } };
    const page = html(ws(missing));
    expect(page).toContain("No options yet");
    expect(page).toContain("If your current bag still works, waiting is a fair choice too.");
    expect(page).toContain("Your needs changed after this shortlist");
    expect(page).not.toContain("role=\"status\">Pick");
  });

  it("uses only the new kit, mascot and parts", () => {
    for (const file of ["OptionsStage.tsx", "OptionCard.tsx", "EndWithoutBuying.tsx"]) {
      const code = readFileSync(`src/pica/features/workspace/${file}`, "utf8");
      expect(code).not.toMatch(/@\/components\/(ui|pica)\b|shared\/ErrorNotice/);
      expect(code).not.toMatch(/useWorkspace\(|usePicaChat\(|useMediaQuery/);
    }
  });
});
