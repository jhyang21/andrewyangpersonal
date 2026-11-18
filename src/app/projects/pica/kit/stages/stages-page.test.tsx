import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StagesPreview } from "./StagesPreview";
import { STAGES, pickState, type StageKey } from "./stage-states";

const pages = (Object.keys(STAGES) as StageKey[]).flatMap((stage) =>
  STAGES[stage].states.map((state) => ({
    name: `${stage}/${state.key}`,
    out: renderToStaticMarkup(<StagesPreview stage={stage} state={state.key} />),
  })),
);
const page = (name: string) => pages.find((item) => item.name === name)!.out;

describe("/projects/pica/kit/stages", () => {
  it("reads the stage and state from the URL, falling back to the first", () => {
    expect(pickState("compare", "four")).toMatchObject({ stage: "compare", state: { key: "four" } });
    expect(pickState(undefined, "nope")).toMatchObject({ stage: "options", state: { key: "normal" } });
    expect(pickState("compare", ["four"])).toMatchObject({ stage: "compare", state: { key: "three" } });
  });

  it("keeps the store out of the server page, which only passes the URL's words on", () => {
    const code = readFileSync("src/app/projects/pica/kit/stages/page.tsx", "utf8");
    expect(code).not.toMatch(/stage-states|seed\/fixture|@\/lib\/session/);
  });

  it("links every state, marking the current one", () => {
    const out = page("compare/four");
    expect(out).toContain("<h1");
    for (const state of STAGES.compare.states) expect(out).toContain(`href="/projects/pica/kit/stages?stage=compare&amp;state=${state.key}"`);
    expect(out).toMatch(/aria-current="page"[^>]*>Four compared</);
    expect(out).toMatch(/aria-current="page"[^>]*>Compare</);
  });

  it("mounts each stage in each state", () => {
    expect(page("options/normal")).toContain("4 options, in no particular order");
    expect(page("options/busy")).toContain("You can change your picks once Pica has replied.");
    expect(page("options/one")).toContain("Pica has 1 option so far");
    expect(page("options/missing")).toContain("Your needs changed after this shortlist");
    expect(page("options/none")).toContain("No options yet");
    expect(page("compare/four").match(/<th scope="col"/g)).toHaveLength(4);
    expect(page("compare/picks-changed")).toContain("This comparison covers different options");
    expect(page("compare/needs-changed")).toContain(">Update comparison<");
    expect(page("compare/busy")).not.toContain(">Update comparison<");
    expect(page("compare/one")).toContain("Pica has 1 option so far, so there is nothing to compare yet.");
    // The state links name "No comparison yet" too, so look for the heading.
    expect(page("compare/one")).not.toMatch(/<h3[^>]*>No comparison yet</);
    expect(page("compare/no-comparison")).toMatch(/<h3[^>]*>No comparison yet</);
    expect(page("compare/lost")).toContain("fewer than 2 of the options it compared are still in your list");
    expect(page("compare/none")).toContain("Nothing to compare yet");
  });

  it("shows at most one caution banner on Compare, and never the shortlist's", () => {
    for (const state of STAGES.compare.states) {
      const out = page(`compare/${state.key}`);
      const banners = (out.match(/This comparison (covers different options|reflects your earlier needs)/g) ?? []).length;
      expect(banners, state.key).toBeLessThanOrEqual(1);
      expect(out, state.key).not.toContain("Your needs changed after this shortlist");
    }
  });

  it("renders from the page file itself, reading the state from the URL", async () => {
    const { default: StagesPage } = await import("./page");
    const tree = StagesPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ stage: "compare", state: "one" }),
    } as Parameters<typeof StagesPage>[0]);
    // The page wraps the URL reader in Suspense; run the reader as Next would.
    const reader = tree.props.children as ReactElement<object, (props: object) => Promise<ReactElement>>;
    const out = renderToStaticMarkup(await reader.type(reader.props));
    expect(out).toMatch(/aria-current="page"[^>]*>One option</);
    expect(out).toContain("Pica has 1 option so far");
  });

  it("opens no form on load, keeps status roles off controls, and points every aria-controls at an id", () => {
    for (const { name, out } of pages) {
      expect(out, name).not.toContain("<form");
      expect(out, name).not.toContain("autofocus");
      expect(out, name).not.toMatch(/<(button|a)\b[^>]*role="(status|alert)"/);
      const ids = [...out.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size, name).toBe(ids.length);
      for (const id of [...out.matchAll(/aria-controls="([^"]+)"/g)].flatMap((m) => m[1].split(" "))) {
        expect(ids, `${name}: ${id}`).toContain(id);
      }
    }
  });

  it("runs the stages inactive on a stand-in, so it sends no analytics and writes no store", () => {
    const code = readFileSync("src/app/projects/pica/kit/stages/StagesPreview.tsx", "utf8");
    expect(code).not.toMatch(/\btrack\(|\bdispatch\(|useSession|useWorkspace|usePicaChat|active\s*\n?\s*\/>|active=\{true\}/);
    expect(code.match(/active=\{false\}/g)).toHaveLength(2);
    expect(code).not.toMatch(/@\/components\/(ui|pica)\b/);
  });
});
