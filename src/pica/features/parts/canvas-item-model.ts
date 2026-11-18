/**
 * The rules of one need's editor, without React: its words, the names its
 * buttons carry for screen readers, and what pressing "Save change" sends.
 */
import type { CanvasEdit } from "@/pica/lib/session";
import type { CanvasItem } from "@/pica/lib/types";
import { itemSaveEdit } from "@/pica/features/workspace/canvas-model";

export const EDITOR = {
  confirm: "Confirm",
  save: "Save change",
  cancel: "Cancel",
  blank: "Write the need, or remove it instead.",
} as const;

/** Names that say which need each button acts on. */
export function editorLabels(item: Pick<CanvasItem, "text">) {
  const quoted = `“${item.text}”`;
  return {
    confirm: `Confirm ${quoted}`,
    edit: `Edit ${quoted}`,
    remove: `Remove ${quoted}`,
    field: `Edit ${quoted}`,
    cancelTail: `editing ${quoted}`,
  };
}

/** A stable id for a need's Edit button. `scope` keeps two lists of the same needs apart. */
export function editButtonId(scope: string, itemId: string): string {
  return `${scope}-edit-${itemId.replace(/[^\w-]/g, "_")}`;
}

/**
 * Which row's Edit button takes focus after a need is removed: the next
 * row, else the one before. Null when the list is now empty: focus its
 * heading. `ids` is the list's order before the removal.
 */
export function focusAfterRemove(ids: readonly string[], removedId: string): string | null {
  const at = ids.indexOf(removedId);
  if (at === -1) return null;
  return ids[at + 1] ?? ids[at - 1] ?? null;
}

export type EditorSave = { kind: "blank" } | { kind: "unchanged" } | { kind: "edit"; edit: CanvasEdit };

/**
 * What "Save change" does. Blank words keep the form open with a hint.
 * The buyer's own words, unchanged, close it and send nothing. Anything
 * else is a change; saving a guess, even unchanged, makes it the buyer's.
 */
export function editorSave(item: CanvasItem, text: string): EditorSave {
  if (!text.trim()) return { kind: "blank" };
  const edit = itemSaveEdit(item, text);
  return edit ? { kind: "edit", edit } : { kind: "unchanged" };
}
