import { editButtonId, focusAfterRemove } from "./canvas-item-model";

export interface RemovedFrom {
  /** The scope the list passed to `editButtonId` for its rows. */
  scope: string;
  /** The list's need ids in order, before the removal. */
  ids: readonly string[];
  removedId: string;
  /** The id of the list's heading. Give it `tabIndex={-1}` so it can take focus. */
  headingId: string;
}

/** Something that can take focus, found by id. The page's `document` by default. */
type FindById = (id: string) => { focus: () => void } | null;

/**
 * What a list calls after a need is removed, since that row is gone: it
 * focuses the next row's Edit button, else the one before. If that button
 * is not on the page (its row is open as a form) or no row is left, it
 * focuses the heading.
 */
export function placeFocusAfterRemove(list: RemovedFrom, find: FindById = (id) => document.getElementById(id)): void {
  const next = focusAfterRemove(list.ids, list.removedId);
  const target = (next ? find(editButtonId(list.scope, next)) : null) ?? find(list.headingId);
  target?.focus();
}
