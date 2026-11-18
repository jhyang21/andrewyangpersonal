/**
 * WCAG 2.1 contrast, worked out by formula. Used by the kit's tests to check
 * token pairs against the brief; the browser measure stays the final word.
 */

/** "#666362" or "666362" to [r, g, b] in 0..255. */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16)) as [number, number, number];
}

/** One sRGB channel (0..255) to linear light. */
function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** (lighter + 0.05) / (darker + 0.05). Always 1 or more. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
