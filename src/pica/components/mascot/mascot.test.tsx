import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MascotSheet, SHEET_SIZES } from "./MascotSheet";
import { PICA_COLORS, PLAIN_WHITE_LINE, Pica, SIMPLE_BELOW, THINKING_LABEL } from "./Pica";
import { PicaAvatar, avatarBirdSize, avatarShift, type AvatarSize } from "./PicaAvatar";
import { PicaLiveRegion } from "./PicaLiveRegion";
import { PicaThinking } from "./PicaThinking";
import {
  BEAD,
  BILL_TIP,
  GROUND,
  LEG_LENGTH,
  PICA_POSES,
  POSES,
  SIT_LEG_SCALE,
  TAIL_LENGTH,
  headPlace,
  inkOffset,
  outlineBounds,
  outlinePoints,
  tailPlace,
  toGrid,
  type PicaPose,
} from "./poses";

const SIZES = [24, 32, 40, 48, 64, 120];
const AVATAR_SIZES: AvatarSize[] = [32, 40];
const QUIET_POSES = PICA_POSES.filter((pose) => pose !== "thinking");

const svgTag = (html: string) => html.match(/<svg[^>]*>/)?.[0] ?? "";

describe("Pica renders every pose", () => {
  it("has the eight poses from the brief", () => {
    expect([...PICA_POSES]).toEqual([
      "idle",
      "listening",
      "thinking",
      "found",
      "weighing",
      "unsure",
      "resting",
      "settled",
    ]);
  });

  it.each(PICA_POSES)("%s renders at every size on the 48 grid", (pose) => {
    for (const size of SIZES) {
      const tag = svgTag(renderToStaticMarkup(<Pica pose={pose} size={size} />));
      expect(tag).toContain('viewBox="0 0 48 48"');
      expect(tag).toContain(`width="${size}"`);
      expect(tag).toContain(`height="${size}"`);
      expect(tag).toContain(`data-pose="${pose}"`);
      expect(tag).toContain(`pica-mascot-pose-${pose}`);
    }
  });

  it("draws a different picture for each pose, at the plain and the full size", () => {
    for (const size of [24, 120]) {
      const drawings = new Set(PICA_POSES.map((pose) => renderToStaticMarkup(<Pica pose={pose} size={size} />)));
      expect(drawings.size).toBe(PICA_POSES.length);
    }
  });

  // This reads the stroke values written into the markup, not rendered pixels;
  // the renders in headless Chrome are the check that the white shows.
  it("writes the plainer bird below 32px: no pupil, heavier outline, belly line set to about 1px", () => {
    const plain = renderToStaticMarkup(<Pica size={SIMPLE_BELOW - 8} />);
    const full = renderToStaticMarkup(<Pica size={SIMPLE_BELOW} />);
    const circles = (html: string) => (html.match(/<circle/g) ?? []).length;
    expect(circles(full)).toBe(circles(plain) + 1);
    // The wing carries the full outline line.
    const outline = (html: string) => Number(html.match(/<path d="M7.5 -10.5[^>]*stroke-width="([\d.]+)"/)?.[1]);
    expect(outline(plain)).toBeGreaterThan(outline(full));
    // The belly keeps its white at 24: its line is about 1px, well under the outline.
    const belly = (html: string) => Number(html.match(/<ellipse[^>]*stroke-width="([\d.]+)"/)?.[1]);
    expect(belly(plain)).toBe(PLAIN_WHITE_LINE);
    expect(belly(plain) * ((SIMPLE_BELOW - 8) / 48)).toBeLessThanOrEqual(1);
    expect(belly(plain)).toBeLessThan(outline(plain) * 0.6);
  });

  it("takes its drawing level from `detail` when set, apart from the size", () => {
    const plain = renderToStaticMarkup(<Pica size={24} />);
    const full = renderToStaticMarkup(<Pica size={48} />);
    const circles = (html: string) => (html.match(/<circle/g) ?? []).length;
    expect(circles(renderToStaticMarkup(<Pica size={24} detail="full" />))).toBe(circles(full));
    expect(circles(renderToStaticMarkup(<Pica size={48} detail="plain" />))).toBe(circles(plain));
  });

  it("defaults to idle at 48", () => {
    const tag = svgTag(renderToStaticMarkup(<Pica />));
    expect(tag).toContain('data-pose="idle"');
    expect(tag).toContain('width="48"');
  });
});

describe("the pose data gives each pose its own outline, not only a detail", () => {
  /**
   * True when two poses' data differ in something that should change the
   * silhouette at 24px. This checks the numbers in poses.ts, not the drawing;
   * the 24px renders are the check that the difference shows. A head turned
   * back does not count on its own: at 24 it is a few pixels of bill.
   */
  function outlineDiffers(a: PicaPose, b: PicaPose): boolean {
    const p = POSES[a];
    const q = POSES[b];
    return (
      Math.abs(p.body.a - q.body.a) >= 15 ||
      Math.abs(p.body.y - q.body.y) >= 4 ||
      Math.abs(p.head.a - q.head.a) >= 25 ||
      Math.abs(p.tail - q.tail) >= 25 ||
      p.legs !== q.legs ||
      Boolean(p.holds) !== Boolean(q.holds) ||
      (p.beads?.length ?? 0) !== (q.beads?.length ?? 0)
    );
  }

  it("every pair of poses differs in the data for tilt, height, head, tail, legs or what Pica holds", () => {
    const same: string[] = [];
    for (const [i, a] of PICA_POSES.entries()) {
      for (const b of PICA_POSES.slice(i + 1)) {
        if (!outlineDiffers(a, b)) same.push(`${a}/${b}`);
      }
    }
    expect(same).toEqual([]);
  });

  it("only resting shuts its eyes; settled and resting both sit, the rest stand", () => {
    expect(PICA_POSES.filter((pose) => POSES[pose].eye === "closed")).toEqual(["resting"]);
    expect(PICA_POSES.filter((pose) => POSES[pose].legs === "sit")).toEqual(["resting", "settled"]);
  });
});

describe("every pose stays inside the 48 grid", () => {
  it.each(PICA_POSES)("%s keeps its bill, head, tail, belly, feet and beads in view", (pose) => {
    const outside = outlinePoints(POSES[pose])
      .filter(({ x, y, r }) => x - r < 0 || x + r > 48 || y - r < 0 || y + r > 48)
      .map(({ part }) => part);
    expect(outside).toEqual([]);
  });

  it("beads rest on the ground and standing birds stand above it", () => {
    for (const pose of PICA_POSES) {
      const spec = POSES[pose];
      for (const bead of spec.beads ?? []) expect(bead.y + BEAD).toBeLessThanOrEqual(GROUND);
      if (spec.legs === "stand") expect(spec.body.y).toBeLessThan(GROUND);
    }
  });

  it("a standing bird's tail tip stays above the feet line", () => {
    const low: string[] = [];
    for (const pose of PICA_POSES) {
      if (POSES[pose].legs !== "stand") continue;
      for (const { y, r, part } of outlinePoints(POSES[pose])) {
        if (part.startsWith("tail") && y + r > GROUND) low.push(`${pose} ${part} ${(y + r).toFixed(2)}`);
      }
    }
    expect(low).toEqual([]);
  });

  it("the outline covers the bill tip and tail tip the drawing uses", () => {
    const spec = POSES.idle;
    const parts = outlinePoints(spec);
    const bill = toGrid(headPlace(spec), BILL_TIP);
    const tip = toGrid(tailPlace(spec), { x: -TAIL_LENGTH, y: 0 }, spec.tailLength ?? 1);
    expect(parts.find((p) => p.part === "bill")).toMatchObject(bill);
    expect(parts.find((p) => p.part === "tail tip")).toMatchObject(tip);
  });
});

describe("PicaAvatar: the outline data fits inside its circle", () => {
  /**
   * The bird's square sits in the middle of the circle, moved by the pose's
   * shift. A grid point lies (its distance from the grid's centre, plus the
   * shift) * bird/48 px from the circle's centre, and must clear the 1px
   * ring. This checks outlinePoints(), not rendered pixels; the avatar
   * renders are the check that the points match the ink.
   */
  it.each(AVATAR_SIZES)("at %ipx, every pose's outline points sit inside the ring", (size) => {
    const scale = avatarBirdSize(size) / 48;
    const inner = size / 2 - 1;
    const cut: string[] = [];
    for (const pose of PICA_POSES) {
      const shift = inkOffset(POSES[pose]);
      for (const { x, y, r, part } of outlinePoints(POSES[pose])) {
        if ((Math.hypot(x + shift.x - 24, y + shift.y - 24) + r) * scale > inner) cut.push(`${pose} ${part}`);
      }
    }
    expect(cut).toEqual([]);
  });

  it.each(AVATAR_SIZES)("at %ipx, moves each pose so its outline box is centred in the circle", (size) => {
    const scale = avatarBirdSize(size) / 48;
    for (const pose of PICA_POSES) {
      const box = outlineBounds(POSES[pose]);
      const shift = avatarShift(pose, size);
      // The box's centre, in px from the circle's centre, after the shift.
      expect(((box.minX + box.maxX) / 2 - 24) * scale + shift.x, pose).toBeCloseTo(0, 1);
      expect(((box.minY + box.maxY) / 2 - 24) * scale + shift.y, pose).toBeCloseTo(0, 1);
      expect(renderToStaticMarkup(<PicaAvatar pose={pose} size={size} />)).toContain(
        `style="transform:translate(${shift.x}px, ${shift.y}px)"`,
      );
    }
  });

  it("draws the bird at 0.75 of the diameter, with the plain drawing for its own size", () => {
    expect(avatarBirdSize(40)).toBe(30);
    expect(avatarBirdSize(32)).toBe(24);
    for (const size of AVATAR_SIZES) {
      const html = renderToStaticMarkup(<PicaAvatar size={size} />);
      expect(svgTag(html)).toContain(`width="${avatarBirdSize(size)}"`);
      // The bird is under 32px, so it takes the plain drawing: no pupil, thin belly line.
      expect((html.match(/<circle/g) ?? []).length).toBe(
        (renderToStaticMarkup(<Pica detail="plain" size={avatarBirdSize(size)} />).match(/<circle/g) ?? []).length,
      );
      expect(html).toMatch(new RegExp(`<ellipse[^>]*stroke-width="${PLAIN_WHITE_LINE}"`));
    }
  });
});

describe("screen readers", () => {
  it.each(QUIET_POSES)("%s is hidden and has no name", (pose) => {
    const html = renderToStaticMarkup(<Pica pose={pose} />);
    expect(svgTag(html)).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/role=|aria-label|<title/);
  });

  it("thinking is an image named 'Pica is working on it', not hidden", () => {
    const tag = svgTag(renderToStaticMarkup(<Pica pose="thinking" />));
    expect(THINKING_LABEL).toBe("Pica is working on it");
    expect(tag).toContain('role="img"');
    expect(tag).toContain(`aria-label="${THINKING_LABEL}"`);
    expect(tag).not.toContain("aria-hidden");
  });

  it("thinking takes another name, or none when a live region speaks for it", () => {
    expect(svgTag(renderToStaticMarkup(<Pica pose="thinking" label="Pica is looking" />))).toContain(
      'aria-label="Pica is looking"',
    );
    const quiet = svgTag(renderToStaticMarkup(<Pica pose="thinking" label={null} />));
    expect(quiet).toContain('aria-hidden="true"');
    expect(quiet).not.toContain("aria-label");
  });

  it("a label never names the other poses", () => {
    for (const pose of QUIET_POSES) {
      const tag = svgTag(renderToStaticMarkup(<Pica pose={pose} label="Pica" />));
      expect(tag).toContain('aria-hidden="true"');
      expect(tag).not.toContain("aria-label");
    }
  });

  it("PicaAvatar is silent in every pose, thinking included, so it is never a second named image", () => {
    for (const size of AVATAR_SIZES) {
      for (const pose of PICA_POSES) {
        const html = renderToStaticMarkup(<PicaAvatar pose={pose} size={size} />);
        expect(html, pose).not.toMatch(/role=|aria-label|<title/);
        expect(svgTag(html), pose).toContain('aria-hidden="true"');
      }
    }
  });

  it("PicaThinking speaks through one polite live region, and the drawing stays quiet", () => {
    const html = renderToStaticMarkup(<PicaThinking />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    // The visible words are hidden so the region says them once, not twice.
    expect(html).toContain(`<span aria-hidden="true">${THINKING_LABEL}</span>`);
    expect(svgTag(html)).toContain('aria-hidden="true"');
    expect(svgTag(html)).toContain('data-pose="thinking"');
    expect(html).not.toContain("aria-label");
    expect(renderToStaticMarkup(<PicaThinking label="Pica is looking" />)).toContain(">Pica is looking</span>");
  });

  it("PicaThinking leaves out its region when the screen owns one, and then its words are read in place", () => {
    const html = renderToStaticMarkup(<PicaThinking announce={false} />);
    expect(html).not.toMatch(/role="status"|aria-live/);
    // With no region of its own, the visible label is the one thing a screen reader finds.
    expect(html).toContain(`<span>${THINKING_LABEL}</span>`);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(1);
    expect(svgTag(html)).toContain('aria-hidden="true"');
  });

  it("PicaLiveRegion is one polite, visually hidden region that says the text passed in", () => {
    const html = renderToStaticMarkup(<PicaLiveRegion text="Pica is looking" />);
    expect(html).toBe('<span role="status" aria-live="polite" class="sr-only">Pica is looking</span>');
    // Mounted empty, it says nothing until the screen fills it.
    expect(renderToStaticMarkup(<PicaLiveRegion text="" />)).toBe(
      '<span role="status" aria-live="polite" class="sr-only"></span>',
    );
  });
});

describe("colour comes only from the tokens", () => {
  const allowed: string[] = ["none", ...Object.values(PICA_COLORS)];
  /** Shop's colour tokens in src/pica/styles.css. */
  const TOKENS = [
    "shop-purple",
    "shop-purple-pressed",
    "ink",
    "ink-muted",
    "canvas",
    "surface",
    "hairline",
    "disabled",
    "ink-inverse",
    "purple-soft",
    "purple-tint",
    "success",
    "critical",
    "caution-bg",
    "star",
  ];
  /** Tailwind classes that share a colour prefix but set something else. */
  const NOT_COLOUR = new Set(["left", "body", "caption", "collapse", "t"]);
  const literalColour = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|currentColor|\b(?:black|white)\b/i;

  const everything = [
    ...PICA_POSES.flatMap((pose) => SIZES.map((size) => renderToStaticMarkup(<Pica pose={pose} size={size} />))),
    ...PICA_POSES.map((pose) => renderToStaticMarkup(<PicaAvatar pose={pose} />)),
    renderToStaticMarkup(<PicaThinking />),
    renderToStaticMarkup(<MascotSheet />),
  ];

  it("Pica paints only with ink, surface and purple-soft", () => {
    expect(Object.values(PICA_COLORS)).toEqual([
      "var(--color-ink)",
      "var(--color-surface)",
      "var(--color-purple-soft)",
    ]);
    for (const html of everything) {
      for (const [, value] of html.matchAll(/\b(?:fill|stroke)="([^"]*)"/g)) {
        expect(allowed).toContain(value);
      }
    }
  });

  it("the wing patch is the only purple", () => {
    for (const pose of PICA_POSES) {
      const html = renderToStaticMarkup(<Pica pose={pose} size={48} />);
      expect(html.match(/var\(--color-purple-soft\)/g)).toHaveLength(1);
    }
  });

  it("no colour is written out by value, in markup or in the CSS", () => {
    for (const html of everything) expect(html).not.toMatch(literalColour);
    const css = readFileSync(new URL("./mascot.css", import.meta.url), "utf8");
    expect(css).not.toMatch(literalColour);
  });

  it("colour classes on the avatar, the thinking row and the sheet name Shop tokens", () => {
    for (const html of everything) {
      for (const [, classes] of html.matchAll(/class="([^"]*)"/g)) {
        for (const cls of classes.split(/\s+/)) {
          const colour = cls.match(/^(?:bg|text|border|fill|stroke)-(.+)$/)?.[1];
          if (!colour || NOT_COLOUR.has(colour)) continue;
          expect(TOKENS, cls).toContain(colour);
        }
      }
    }
  });
});

describe("motion", () => {
  const css = readFileSync(new URL("./mascot.css", import.meta.url), "utf8");
  /** Innermost `selector { body }` rules; keyframe steps come out as their own rules. */
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({
    selector: sel.trim(),
    body,
  }));
  const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

  it("loops only in the thinking pose", () => {
    const looping = rules.filter((rule) => /animation:(?!\s*none)/.test(rule.body));
    expect(looping.length).toBeGreaterThan(0);
    for (const rule of looping) {
      for (const sel of rule.selector.split(",")) expect(sel).toContain(".pica-mascot-pose-thinking");
    }
  });

  it("times every move with the motion tokens, each with a fallback", () => {
    const timed = rules.filter((rule) => /(?:animation|transition):(?!\s*none)/.test(rule.body));
    for (const rule of timed) {
      expect(rule.body).toMatch(/var\(--duration-(?:fast|base|slow), \d+ms\)/);
      expect(rule.body).not.toMatch(/\b\d+(?:\.\d+)?m?s\b(?![^(]*\))/);
    }
    expect(css).toContain("var(--ease-out-soft, cubic-bezier(0.2, 0.8, 0.2, 1))");
  });

  it("stops every move under reduced motion", () => {
    expect(reduced).not.toBe("");
    const moving = rules.filter(
      (rule) => !reduced.includes(rule.body) && /(?:animation|transition):(?!\s*none)/.test(rule.body),
    );
    for (const rule of moving) {
      for (const sel of rule.selector.split(",")) {
        expect(reduced, `reduced motion stops ${sel.trim()}`).toContain(sel.trim());
      }
    }
    expect(reduced).toMatch(/transition: none;\s*animation: none;/);
  });

  /** Each placed part's class and style, in drawing order. */
  const partsOf = (pose: PicaPose) =>
    [...renderToStaticMarkup(<Pica pose={pose} />).matchAll(/<g class="(pica-mascot-part[^"]*)" style="([^"]+)"/g)].map(
      ([, cls, style]) => ({ cls, style }),
    );

  it("mounts the same four parts in every pose, placed with CSS transforms, so any change can slide", () => {
    for (const pose of PICA_POSES) {
      const parts = partsOf(pose);
      expect(parts, pose).toHaveLength(4);
      for (const { style } of parts) expect(style).toMatch(/^transform:translate\(/);
      expect(renderToStaticMarkup(<Pica pose={pose} />)).toContain('class="pica-mascot-tilt"');
    }
  });

  it("keeps the legs mounted: sitting folds them down and fades them, standing shows them", () => {
    for (const pose of PICA_POSES) {
      const [legs] = partsOf(pose);
      expect(legs.cls, pose).toContain("pica-mascot-legs");
      if (POSES[pose].legs === "sit") {
        expect(legs.style).toContain(`scale(1, ${SIT_LEG_SCALE})`);
        expect(legs.style).toContain("opacity:0");
      } else {
        expect(legs.style).toContain("scale(1, 1)");
        expect(legs.style).toContain("opacity:1");
      }
    }
    expect(rules.find((rule) => rule.selector === ".pica-mascot .pica-mascot-part")?.body).toMatch(
      /opacity var\(--duration-slow, 320ms\)/,
    );
  });

  it("moves the feet along the ground line only, so they never dip under it mid-slide", () => {
    const drawn = new Set<string>();
    for (const pose of PICA_POSES) {
      const [legs] = partsOf(pose);
      // Every pose places the legs' frame on the ground with no turn ...
      expect(legs.style, pose).toContain(`translate(${POSES[pose].body.x}px, ${GROUND}px) rotate(0deg)`);
      // ... and draws the same legs, so only x and the fold change between poses.
      const html = renderToStaticMarkup(<Pica pose={pose} />);
      drawn.add(html.match(/pica-mascot-legs[\s\S]*?<\/g><\/g>/)?.[0].replace(/style="[^"]*"/, "") ?? "");
      // Standing legs reach the hip.
      if (POSES[pose].legs === "stand") expect(GROUND - POSES[pose].body.y).toBeLessThanOrEqual(LEG_LENGTH);
    }
    expect(drawn.size).toBe(1);
    expect([...drawn][0]).toMatch(/<path d="M-1\.5 -13 /);
  });

  it("flips the head for unsure in a group that never slides", () => {
    for (const pose of PICA_POSES) {
      const head = partsOf(pose)[3];
      expect(head.style, pose).toMatch(/scale\(1, 1\)$/);
      const flip = renderToStaticMarkup(<Pica pose={pose} />).match(/class="pica-mascot-flip" style="transform:([^"]+)"/)?.[1];
      expect(flip, pose).toBe(POSES[pose].head.back ? "scale(-1, 1)" : "scale(1, 1)");
    }
    const flipRule = rules.find((rule) => rule.selector === ".pica-mascot .pica-mascot-flip");
    expect(flipRule?.body).toMatch(/transition: none/);
  });
});

describe("CSS names", () => {
  const names = (css: string) => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    return {
      classes: new Set([...bare.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(([, name]) => name)),
      keyframes: new Set([...bare.matchAll(/@keyframes\s+([\w-]+)/g)].map(([, name]) => name)),
    };
  };
  const ours = names(readFileSync(new URL("./mascot.css", import.meta.url), "utf8"));

  it("names the keyframes pica-mascot-tilt and pica-mascot-blink", () => {
    expect([...ours.keyframes].sort()).toEqual(["pica-mascot-blink", "pica-mascot-tilt"]);
    for (const name of ours.classes) expect(name).toMatch(/^pica-mascot(?:-|$)/);
  });
});

describe("MascotSheet", () => {
  it("shows every pose at 24, 48 and 120, named in text", () => {
    expect([...SHEET_SIZES]).toEqual([24, 48, 120]);
    const html = renderToStaticMarkup(<MascotSheet />);
    for (const pose of PICA_POSES) {
      expect(html).toContain(`<span class="block font-semibold">${pose}</span>`);
      for (const size of SHEET_SIZES) {
        expect(html).toMatch(new RegExp(`<svg[^>]*width="${size}"[^>]*data-pose="${pose}"`));
      }
    }
    expect((html.match(/<svg/g) ?? []).length).toBe(PICA_POSES.length * SHEET_SIZES.length);
  });

  it("names no bird, since the rows' text names them, and lets one thinking bird loop", () => {
    const html = renderToStaticMarkup(<MascotSheet />);
    expect(html).not.toMatch(/role="img"|aria-label/);
    for (const tag of html.match(/<svg[^>]*>/g) ?? []) expect(tag).toContain('aria-hidden="true"');
    const thinking = (html.match(/<svg[^>]*>/g) ?? []).filter((tag) => tag.includes('data-pose="thinking"'));
    expect(thinking).toHaveLength(SHEET_SIZES.length);
    expect(thinking.filter((tag) => !tag.includes("pica-mascot-still"))).toHaveLength(1);
  });
});
