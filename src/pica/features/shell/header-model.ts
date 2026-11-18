/**
 * Which decision the header is inside, read from the path alone, without
 * React. The header needs no prop from the screen: it reads the address.
 */
import { BASE } from "@/pica/lib/base";
import type { DecisionPlace } from "@/pica/features/decision/actions";

export type HeaderPlace = "workspace" | "decide" | "done";

export interface HeaderDecision {
  id: string;
  place: HeaderPlace;
}

const DECISION_PATH = new RegExp(`^${BASE}/d/([^/]+)(?:/(decide|done))?/?$`);

/** Under BASE: `/d/{id}` is the workspace, `/d/{id}/decide` Decide, `/d/{id}/done` Done. Anything else is outside a decision. */
export function decisionInPath(pathname: string | null): HeaderDecision | null {
  const match = pathname ? DECISION_PATH.exec(pathname) : null;
  if (!match) return null;
  let id: string;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return { id, place: (match[2] as "decide" | "done" | undefined) ?? "workspace" };
}

/**
 * Where the header menu's actions count as sent from, or null where the menu
 * does not show. It shows in the workspace alone: Decide has its own Save and
 * End buttons on the page, which know the option and variant on screen, and
 * Done has its own way to save, end or reopen.
 */
export function menuPlace(place: HeaderPlace): DecisionPlace | null {
  return place === "workspace" ? "workspace" : null;
}
