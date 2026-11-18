import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PartsPreview } from "./PartsPreview";

describe("/projects/pica/kit/parts", () => {
  const out = renderToStaticMarkup(<PartsPreview />);
  const page = readFileSync("src/app/projects/pica/kit/parts/PartsPreview.tsx", "utf8");

  it("renders every section", () => {
    expect(out).toContain("<h1");
    for (const title of ["Header", "Journey path", "Evidence sheet", "Ending a decision", "Did you buy it?", "Notices", "Need editor"]) {
      expect(out).toContain(`>${title}</h2>`);
    }
  });

  it("uses the View parts, so it sends no analytics and writes no store", () => {
    expect(page).not.toMatch(/\btrack\(|\bdispatch\(|useSession|<ErrorNotice\b|<ErrorState\b|<EvidenceSheet\b|<ReturnCheck\b|<StorageNotice\b/);
    expect(page).not.toMatch(/@\/components\/(ui|pica)\b/);
  });

  it("shows the header in and out of a decision, and the Decide stage as Chosen", () => {
    expect(out).toContain("<span>Pica</span>");
    expect(out).toContain('aria-label="Save or end this decision"');
    expect(out).toContain("Chosen");
    expect(out).toContain("Not buying");
  });

  it("shows the header with no decision title, and the menu's place held", () => {
    const header = out.slice(out.indexOf(">Header</h2>"), out.indexOf(">Journey path</h2>"));
    expect(header).not.toContain("row-start-2");
    expect(header).toContain('<div class="flex w-11 shrink-0 justify-end"></div>');
  });

  it("opens no form on load, so nothing takes focus or scrolls the page", () => {
    expect(out).not.toContain("<form");
    expect(out).not.toContain("autofocus");
    expect(out).toContain(">Show a need opened as a form<");
  });

  it("gives the needs list a focusable heading and an id on each Edit button", () => {
    expect(out).toMatch(/<h3 id="parts-needs-heading" tabindex="-1"/i);
    expect(out).toContain('id="parts-needs-edit-seed-need-1"');
  });

  it("shows each notice state", () => {
    expect(out).toContain("Pica can&#x27;t reply right now. Try sending your message again in a moment.");
    expect(out).toContain('role="alert"');
    expect(out).toContain('role="status"');
    expect(out).toContain("Changes aren&#x27;t being saved");
    expect(out).toContain("Update the options");
  });

  it("keeps status roles off buttons and links, and points every aria-controls at an id on the page", () => {
    expect(out).not.toMatch(/<(button|a)\b[^>]*role="(status|alert)"/);
    const controls = [...out.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
    expect(controls.length).toBeGreaterThan(0);
    for (const id of controls) expect(out).toContain(`id="${id}"`);
  });
});
