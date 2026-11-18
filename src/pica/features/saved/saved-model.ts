/**
 * The Saved list (brief 6.8). Pure.
 */
import { checkoutTargetOf } from "@/pica/lib/session";
import type { CatalogProduct, DecisionSession, DecisionStatus } from "@/pica/lib/types";

/** The groups, in the order they show: Open, Saved for later, Bought, Not buying. */
export const GROUP_ORDER: readonly DecisionStatus[] = ["open", "saved", "bought", "declined"];

export interface SavedGroup {
  status: DecisionStatus;
  /** Newest change first. */
  sessions: DecisionSession[];
}

/** Every decision in its status group, newest first. Empty groups are left out. */
export function groupSessions(sessions: Record<string, DecisionSession>): SavedGroup[] {
  const all = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);
  return GROUP_ORDER.map((status) => ({
    status,
    sessions: all.filter((session) => session.decision.status === status),
  })).filter((group) => group.sessions.length > 0);
}

/**
 * The one card that asks "Did you buy it?": the newest checkout the buyer has
 * not answered. Null when none is waiting. ("Not yet" and "Yes" both clear
 * `checkoutStartedAt`, so a set value means unanswered.)
 */
export function askCardId(sessions: Record<string, DecisionSession>): string | null {
  let newest: DecisionSession | null = null;
  for (const session of Object.values(sessions)) {
    if (!session.checkoutStartedAt) continue;
    if (!newest || session.checkoutStartedAt > (newest.checkoutStartedAt ?? 0)) newest = session;
  }
  return newest?.id ?? null;
}

export interface SavedCard {
  /** The product decided on, or else the one taken to checkout. */
  product: CatalogProduct | undefined;
  shortlistCount: number | null;
  /** Open and saved decisions resume; closed ones open. */
  resumable: boolean;
  /** Bought decisions get a check-in. */
  canCheckIn: boolean;
  /** When the check-in was saved, for bought decisions that have one. */
  checkInSavedAt: number | null;
}

export function savedCard(session: DecisionSession): SavedCard {
  const status = session.decision.status;
  const productId = session.decision.productId ?? checkoutTargetOf(session).productId;
  const bought = status === "bought";
  return {
    product: productId ? session.products[productId] : undefined,
    shortlistCount: session.shortlist ? session.shortlist.entries.length : null,
    resumable: status === "open" || status === "saved",
    canCheckIn: bought,
    checkInSavedAt: bought && session.outcome ? session.outcome.submittedAt : null,
  };
}
