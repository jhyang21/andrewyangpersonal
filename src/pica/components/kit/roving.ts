/**
 * Arrow-key movement inside a group where one item holds the tab stop
 * (roving tabindex). Right and Left wrap at the ends; Home and End jump.
 * Returns null for any other key, so the caller lets the key through.
 */
export function rovingIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  if (key === "ArrowRight") return index >= last ? 0 : index + 1;
  if (key === "ArrowLeft") return index <= 0 ? last : index - 1;
  if (key === "Home") return 0;
  if (key === "End") return last;
  return null;
}
