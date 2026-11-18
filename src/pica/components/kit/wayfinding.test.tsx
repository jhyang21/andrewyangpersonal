import { readFileSync } from "node:fs";
import { LayoutGrid, MessageCircle, Columns2 } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BottomBar } from "./BottomBar";
import { StagePath, stageFacts } from "./StagePath";
import { EMPTY_SUMMARY, SummaryStrip, summaryParts, summaryStep, summaryText } from "./SummaryStrip";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const HREFS = { needs: "/projects/pica/d/1?canvas=open", options: "/projects/pica/d/1/options", compare: "/projects/pica/d/1/compare", decide: "/projects/pica/d/1/options" };

describe("stageFacts", () => {
  it("uses the brief's words for empty stages", () => {
    expect(stageFacts({ needs: 0, options: 0, comparing: 0 })).toEqual({
      needs: "None yet",
      options: "None yet",
      compare: "Optional",
      decide: "Nothing chosen",
    });
  });
  it("counts, never a percent", () => {
    expect(stageFacts({ needs: 3, options: 1, comparing: 2, outcome: "Not buying" })).toEqual({
      needs: "3 needs",
      options: "1 option",
      compare: "Comparing 2",
      decide: "Not buying",
    });
    expect(stageFacts({ needs: 1, options: 4, comparing: 0 }).needs).toBe("1 need");
  });
  it("Decide reads Chosen while an option is chosen and the decision is open; an outcome wins", () => {
    expect(stageFacts({ needs: 1, options: 4, comparing: 0, chosen: true }).decide).toBe("Chosen");
    expect(stageFacts({ needs: 1, options: 4, comparing: 0, chosen: false }).decide).toBe("Nothing chosen");
    expect(stageFacts({ needs: 1, options: 4, comparing: 0, chosen: true, outcome: "Saved" }).decide).toBe("Saved");
  });
});

describe("StagePath", () => {
  const out = html(<StagePath counts={{ needs: 3, options: 4, comparing: 0 }} hrefs={HREFS} current="options" />);

  it("is a nav named Decision stages with four links, none locked", () => {
    expect(out).toMatch(/^<nav aria-label="Decision stages">/);
    expect(out.match(/<a /g)).toHaveLength(4);
    expect(out).not.toMatch(/aria-disabled|disabled/);
    for (const href of new Set(Object.values(HREFS))) expect(out).toContain(`href="${href.replace("&", "&amp;")}"`);
  });

  it("marks the current stage with aria-current=step, fill, 2px ink edge and semibold, and no tick", () => {
    const links = out.split("<a ").slice(1);
    const current = links.filter((l) => l.includes('aria-current="step"'));
    expect(current).toHaveLength(1);
    expect(current[0]).toContain(">Options<");
    expect(current[0]).toMatch(/border-2[^"]*border-ink bg-purple-soft font-semibold/);
    expect(out).not.toContain("lucide-check");
  });

  it("on phones shows the fact under the current stage only; the others stay readable to screen readers", () => {
    const links = out.split("<a ").slice(1);
    for (const link of links) {
      if (link.includes('aria-current="step"')) {
        expect(link).toMatch(/class="[^"]*inline-block text-ink"><span class="sr-only">, <\/span>4 options/);
      } else {
        expect(link).toMatch(/class="[^"]*sr-only text-ink-soft sm:not-sr-only sm:inline-block"/);
        // display:none would drop the fact from the accessibility tree too.
        expect(link).not.toMatch(/class="(?:[^"]* )?hidden[ "]/);
      }
    }
    expect(out).toContain("3 needs");
    expect(out).toContain("Optional");
    expect(out).toContain("Nothing chosen");
  });
});

describe("BottomBar", () => {
  const items = [
    { id: "chat", href: "/projects/pica/d/1", label: "Chat", icon: MessageCircle },
    { id: "options", href: "/projects/pica/d/1/options", label: "Options", icon: LayoutGrid, count: 4, countLabel: "4 options" },
    { id: "compare", href: "/projects/pica/d/1/compare", label: "Compare", icon: Columns2, count: 0 },
  ];

  it("is a nav of links, not a tab list, with the current view marked", () => {
    const out = html(<BottomBar items={items} current="chat" />);
    expect(out).toMatch(/^<nav aria-label="Views" class="kit-bottom-bar bg-surface/);
    expect(out).toContain("shadow-float");
    expect(out).toContain("safe-area-inset-bottom");
    expect(out).not.toMatch(/role="tab/);
    expect(out.match(/<a /g)).toHaveLength(3);
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-current="page"[^>]*>.*?border-ink bg-purple-soft/);
  });

  it("shows a count only once it is above 0, with words for screen readers", () => {
    const out = html(<BottomBar items={items} />);
    expect(out).toContain('<span class="sr-only">, 4 options</span>');
    expect(out.match(/sr-only">, /g)).toHaveLength(1);
  });

  it("keeps each label on one line, and sizes in px all but the label, so large text barely grows the bar", () => {
    const out = html(<BottomBar items={items} current="options" />);
    expect(out.match(/whitespace-nowrap">(Chat|Options|Compare)</g)).toHaveLength(3);
    expect(out).not.toContain("break-words");
    for (const cls of ["min-h-[56px]", "py-[6px]", "gap-[2px]", "h-[32px]", "w-[56px]", "-top-[6px]"]) expect(out).toContain(cls);
    // No rem spacing left on a link or its pill.
    const tokens = [...out.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(" "));
    for (const cls of ["min-h-14", "h-8", "w-14", "py-1.5", "gap-0.5", "-top-1.5", "-right-1"]) expect(tokens).not.toContain(cls);
  });

  it("hides while typing only when asked", () => {
    expect(html(<BottomBar items={items} />)).not.toContain("data-hide-while-typing");
    expect(html(<BottomBar items={items} hideWhileTyping />)).toContain('data-hide-while-typing="true"');
    const css = readFileSync("src/pica/components/kit/kit.css", "utf8");
    expect(css).toMatch(/\):focus\s*\)\s*\.kit-bottom-bar\[data-hide-while-typing\]/);
  });

  it("hides only for fields that open a keyboard, not any focused input", () => {
    const css = readFileSync("src/pica/components/kit/kit.css", "utf8");
    const rule = css.slice(css.indexOf("html:has("), css.indexOf(".kit-bottom-bar[data-hide-while-typing]"));
    for (const field of ["textarea", '[contenteditable]:not([contenteditable="false"])', "input:not([type])", 'input[type="text"]', 'input[type="search"]', 'input[type="email"]']) {
      expect(rule).toContain(field);
    }
    expect(rule).not.toMatch(/\(\s*input\s*,|,\s*input\s*,|\bselect\b/);
    expect(rule).not.toContain('type="checkbox"');
  });
});

describe("summaryText", () => {
  it("joins the parts that have a value", () => {
    expect(summaryText({ category: "Backpacks", budget: "under $200", needs: 3, toConfirm: 1 })).toBe(
      "Backpacks · under $200 · 3 needs · 1 to confirm",
    );
    expect(summaryParts({ category: " ", budget: null, needs: 1, toConfirm: 0 })).toEqual(["1 need"]);
  });
  it("reads Your needs: none yet with nothing", () => {
    expect(summaryText({ needs: 0, toConfirm: 0 })).toBe(EMPTY_SUMMARY);
    expect(EMPTY_SUMMARY).toBe("Your needs: none yet");
  });
});

describe("SummaryStrip", () => {
  it("is a button with the status region beside it, not inside it", () => {
    const out = html(<SummaryStrip category="Backpacks" needs={3} toConfirm={1} onOpen={() => undefined} controls="canvas" />);
    expect(out).toMatch(/<button type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="canvas"/);
    expect(out).toMatch(/<\/button><p role="status" class="sr-only"><\/p><\/div>$/);
    const button = out.slice(out.indexOf("<button"), out.indexOf("</button>"));
    expect(button).not.toContain("role=");
    expect(button).toContain('<span class="sr-only">Your needs: </span>');
    expect(button).toContain('<span aria-hidden="true"> · </span><span class="sr-only">, </span>');
  });
  it("shows the empty line in ink-soft", () => {
    const out = html(<SummaryStrip needs={0} toConfirm={0} onOpen={() => undefined} />);
    expect(out).toContain('<span class="text-ink-soft">Your needs: none yet</span>');
  });
  it("keeps a count with its word using an escaped no-break space, not a raw one", () => {
    const out = html(<SummaryStrip needs={3} toConfirm={1} onOpen={() => undefined} />);
    expect(out).toContain("3 needs");
    const source = readFileSync("src/pica/components/kit/SummaryStrip.tsx", "utf8");
    expect(source).not.toContain(" ");
    expect(source).toContain('"$1\\u00a0"');
  });
  it("announce defaults on and can be turned off; the first render is silent either way", () => {
    for (const announce of [undefined, true, false]) {
      const out = html(<SummaryStrip needs={3} toConfirm={0} onOpen={() => undefined} announce={announce} />);
      expect(out).toContain('<p role="status" class="sr-only"></p>');
    }
  });
});

describe("summaryStep", () => {
  // Walk the strip's render-time rule through a screen that renders empty,
  // loads the decision with announce off, then changes with it on.
  // Mirrors the component: the rule is told to announce only when
  // `announce` was on in the last render as well as this one.
  function walk(steps: { input: { needs: number; toConfirm: number; category?: string }; announce: boolean }[]) {
    let shown = summaryText(steps[0].input);
    let wasOn = steps[0].announce;
    const heard: string[] = [];
    for (const { input, announce } of steps.slice(1)) {
      const step = summaryStep(shown, input, announce && wasOn);
      wasOn = announce;
      if (!step) continue;
      shown = step.shown;
      if (step.announcement !== undefined) heard.push(step.announcement);
    }
    return heard;
  }

  it("data and the switch to on in one render (announce={!loading}) stay silent", () => {
    const heard = walk([
      { input: { needs: 0, toConfirm: 0 }, announce: false },
      { input: { category: "Backpacks", needs: 3, toConfirm: 1 }, announce: true },
      { input: { category: "Backpacks", needs: 4, toConfirm: 1 }, announce: true },
    ]);
    expect(heard).toEqual(["Needs updated: Backpacks, 4 needs, 1 to confirm"]);
  });

  it("says nothing when the text has not changed", () => {
    expect(summaryStep("2 needs", { needs: 2, toConfirm: 0 }, true)).toBeNull();
  });

  it("a load made with announce off is silent; later changes are heard", () => {
    const heard = walk([
      { input: { needs: 0, toConfirm: 0 }, announce: false },
      { input: { category: "Backpacks", needs: 3, toConfirm: 1 }, announce: false },
      { input: { category: "Backpacks", needs: 3, toConfirm: 1 }, announce: true },
      { input: { category: "Backpacks", needs: 4, toConfirm: 1 }, announce: true },
    ]);
    expect(heard).toEqual(["Needs updated: Backpacks, 4 needs, 1 to confirm"]);
  });

  it("with the default on, a change is heard, including back to empty", () => {
    const heard = walk([
      { input: { needs: 1, toConfirm: 0 }, announce: true },
      { input: { needs: 0, toConfirm: 0 }, announce: true },
    ]);
    expect(heard).toEqual(["Needs updated: none yet"]);
  });
});

describe("kit.css", () => {
  it("drives motion from the tokens and turns it off under reduced motion", () => {
    const css = readFileSync("src/pica/components/kit/kit.css", "utf8");
    expect(css).toContain("animation: kit-land var(--duration-slow) var(--ease-settle)");
    expect(css).toContain("animation: kit-lift var(--duration-slow) var(--ease-settle)");
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.kit-land,\s*\.kit-lift\s*\{\s*animation: none;/);
    expect(css).not.toMatch(/infinite/);
  });
});
