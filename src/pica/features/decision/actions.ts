import { track } from "@/pica/lib/analytics";
import { checkoutTargetOf, dispatch, getSession } from "@/pica/lib/session";

export type DecisionPlace = "workspace" | "shortlist" | "decide";

export function saveForLater(sessionId: string, from: DecisionPlace, productId?: string, variantId?: string) {
  // Refused on a bought decision: then nothing to count.
  if (!dispatch(sessionId, { type: "decided", status: "saved", productId, variantId, at: Date.now() })) return;
  track("session_saved", { from, productId: productId ?? null }, sessionId);
}

/** Fires `no_purchase_decided` once, when the decision turns to "not buying". The reason never goes to analytics. */
export function endWithoutBuying(sessionId: string, from: DecisionPlace, productId?: string) {
  const before = getSession(sessionId)?.decision.status;
  const changed = dispatch(sessionId, { type: "decided", status: "declined", productId, at: Date.now() });
  if (changed && before !== "declined") {
    track("no_purchase_decided", { from, productId: productId ?? null }, sessionId);
  }
}

/**
 * "Yes, I bought it". Fires `purchase_completed` only when the store took the
 * answer: not twice, and not after another tab already answered.
 */
export function recordPurchase(sessionId: string): boolean {
  const session = getSession(sessionId);
  if (!session) return false;
  const target = checkoutTargetOf(session);
  if (!dispatch(sessionId, { type: "checkout_answered", bought: true, at: Date.now() })) return false;
  track("purchase_completed", { productId: target.productId ?? null, variantId: target.variantId ?? null }, sessionId);
  return true;
}

/** Reason codes for not buying. Codes go to analytics; labels stay on screen. */
export const DECLINE_REASONS = [
  { code: "dont_need_it", label: "I don't need it after all" },
  { code: "too_expensive", label: "Too expensive for what it is" },
  { code: "nothing_fit", label: "Nothing fit my needs" },
  { code: "have_one", label: "What I have still works" },
  { code: "buying_elsewhere", label: "Buying somewhere else" },
  { code: "not_now", label: "Not right now" },
] as const;
