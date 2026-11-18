/**
 * What Done and the "Did you buy it?" card show for a decision. Pure.
 */
import { checkoutTargetOf } from "@/pica/lib/session";
import type { CatalogProduct, DecisionSession, DecisionStatus } from "@/pica/lib/types";

export interface DoneView {
  status: DecisionStatus;
  /** The product decided on, when the session has its record. */
  product: CatalogProduct | undefined;
  /** Checkout was started and the buyer has not said whether they bought. */
  askBought: boolean;
  /** The optional "why not" reasons show for not buying only. */
  showReasons: boolean;
  /** The confidence check shows for bought, not buying and saved; never for open (brief 6.7). */
  showConfidence: boolean;
}

/**
 * While "Did you buy it?" is up, the screen does not yet say how the
 * decision ended, so neither the reasons nor the confidence check show.
 */
export function doneView(session: DecisionSession): DoneView {
  const status = session.decision.status;
  const productId = session.decision.productId;
  const askBought = Boolean(session.checkoutStartedAt);
  return {
    status,
    product: productId ? session.products[productId] : undefined,
    askBought,
    showReasons: !askBought && status === "declined",
    showConfidence: !askBought && status !== "open",
  };
}

/** Tapping the chosen reason again clears it. */
export function toggleReason(current: string | undefined, code: string): string | undefined {
  return current === code ? undefined : code;
}

/**
 * The product the "Did you buy it?" card asks about, or null when there is no
 * checkout to ask about. Asked after any checkout start, even on a closed
 * decision: "Not yet" leaves that decision as it was.
 */
export function returnCheckOf(session: DecisionSession): { product: CatalogProduct | undefined } | null {
  if (!session.checkoutStartedAt) return null;
  const target = checkoutTargetOf(session);
  return { product: target.productId ? session.products[target.productId] : undefined };
}
