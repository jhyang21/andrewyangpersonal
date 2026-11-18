import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decisionInPath, menuPlace } from "./header-model";
import { HeaderView, MenuSlot } from "./HeaderView";

describe("decisionInPath", () => {
  it("finds the decision and the screen from the address", () => {
    expect(decisionInPath("/projects/pica/d/abc")).toEqual({ id: "abc", place: "workspace" });
    expect(decisionInPath("/projects/pica/d/abc/")).toEqual({ id: "abc", place: "workspace" });
    expect(decisionInPath("/projects/pica/d/abc/decide")).toEqual({ id: "abc", place: "decide" });
    expect(decisionInPath("/projects/pica/d/abc/done")).toEqual({ id: "abc", place: "done" });
    expect(decisionInPath("/projects/pica/d/seed%20one")).toEqual({ id: "seed one", place: "workspace" });
  });

  it("is outside a decision everywhere else", () => {
    for (const path of [null, "/", "/projects/pica/browse", "/projects/pica/saved", "/projects/pica/kit/parts", "/d", "/projects/pica/d/", "/projects/pica/d/abc/other", "/projects/pica/d/%E0%A4%A"]) {
      expect(decisionInPath(path)).toBeNull();
    }
  });

  it("shows the menu in the workspace alone, not on Decide or Done", () => {
    expect(menuPlace("workspace")).toBe("workspace");
    expect(menuPlace("decide")).toBeNull();
    expect(menuPlace("done")).toBeNull();
  });
});

describe("HeaderView", () => {
  it("says Pica with the mark, links home, and offers Browse and Saved", () => {
    const out = renderToStaticMarkup(<HeaderView />);
    expect(out).toMatch(/^<header/);
    const home = /<a [^>]*href="\/projects\/pica"[^>]*>([\s\S]*?)<\/a>/.exec(out)?.[1] ?? "";
    expect(home).toMatch(/<svg[^>]*width="32"/);
    expect(home).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(home).toMatch(/<span>Pica<\/span>$/);
    expect(out).toContain('<nav aria-label="Main"');
    expect(out).toContain('href="/projects/pica/browse"');
    expect(out).toContain('href="/projects/pica/saved"');
    expect(out).not.toContain("Shop Companion");
  });

  it("is one 64px bar with no decision title, the menu after the nav", () => {
    const out = renderToStaticMarkup(<HeaderView menu={<button type="button">Menu</button>} />);
    expect(out).toContain("h-16");
    expect(out).not.toMatch(/row-start-2|<p\b/);
    // The menu after the nav, so Tab and reading order match the bar.
    expect(out.indexOf(">Menu<")).toBeGreaterThan(out.indexOf('href="/projects/pica/saved"'));
  });

  it("wraps at large text rather than scroll sideways, the links and menu together on the right", () => {
    const out = renderToStaticMarkup(<HeaderView menu={<button type="button">Menu</button>} />);
    const row = out.match(/<header[^>]*><div class="([^"]*)"/)?.[1].split(" ") ?? [];
    expect(row).toEqual(expect.arrayContaining(["flex-wrap", "min-h-16"]));
    expect(row).not.toContain("h-16");
    const right = /<div class="ml-auto flex flex-wrap[^"]*">(.*)<\/div><\/div><\/header>$/.exec(out)?.[1] ?? "";
    expect(right).toMatch(/^<nav aria-label="Main"/);
    expect(right).toContain(">Menu<");
  });
});

describe("MenuSlot", () => {
  it("holds 44px whether the menu shows or not", () => {
    expect(renderToStaticMarkup(<MenuSlot />)).toBe('<div class="flex w-11 shrink-0 justify-end"></div>');
    expect(renderToStaticMarkup(<MenuSlot><button type="button">Menu</button></MenuSlot>)).toContain("w-11");
  });
});