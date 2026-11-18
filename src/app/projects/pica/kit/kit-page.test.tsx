import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PICA_POSES } from "@/pica/components/mascot";
import { KitPreview } from "./KitPreview";

describe("/projects/pica/kit", () => {
  const out = renderToStaticMarkup(<KitPreview />);

  it("renders and shows the ink-soft sum", () => {
    expect(out).toContain("Component kit");
    expect(out).toContain("= 5.40:1, above the 4.5:1 floor");
  });

  it("uses the token values in styles.css", () => {
    const globals = readFileSync("src/pica/styles.css", "utf8");
    const page = readFileSync("src/app/projects/pica/kit/KitPreview.tsx", "utf8");
    const block = page.slice(page.indexOf("const HEX = {"), page.indexOf("} as const;"));
    const pairs = [...block.matchAll(/"?([\w-]+)"?: "(#[0-9a-f]{6})"/gi)];
    expect(pairs.length).toBe(6);
    for (const [, name, hex] of pairs) {
      expect(globals.toLowerCase()).toContain(`--color-${name}: ${hex.toLowerCase()};`);
    }
  });

  it("imports the new kit and the new mascot, never the old kit or the old mascot", () => {
    const page = readFileSync("src/app/projects/pica/kit/KitPreview.tsx", "utf8");
    expect(page).toContain('from "@/pica/components/kit"');
    expect(page).toContain('from "@/pica/components/mascot"');
    expect(page).not.toMatch(/@\/components\/(ui|pica)\b/);
  });

  it("shows Pica in every pose", () => {
    for (const pose of PICA_POSES) expect(out).toContain(`pica-mascot-pose-${pose}`);
  });

  it("keeps status roles off buttons and links", () => {
    expect(out).not.toMatch(/<(button|a)\b[^>]*role="(status|alert)"/);
  });

  it("shows the review's new states", () => {
    // Toggles, a disclosure, and one-height stacks.
    expect(out).toContain('aria-pressed="false"');
    expect(out).toContain('aria-pressed="true"');
    expect(out).toMatch(/id="kit-more"[^>]*aria-expanded="false"[^>]*aria-controls="kit-more-panel"/);
    expect(out).toContain("Go to Ridgeline Outfitters and Supply Company of Portland to pay");
    // Every aria-controls points at an id that is on the page, the Sheet's included.
    const controls = [...out.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
    expect(controls).toContain("kit-sheet");
    for (const id of controls) expect(out).toContain(`id="${id}"`);
  });
});
