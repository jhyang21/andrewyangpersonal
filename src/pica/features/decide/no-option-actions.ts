import { checkoutTargetOf } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { endWithoutBuying, saveForLater } from "@/pica/features/decision/actions";

/**
 * "Save for later" with no option on screen. It passes on the product and
 * size or colour the decision already holds, so the save forgets neither.
 */
export function saveWithNothingChosen(session: DecisionSession): void {
  const held = checkoutTargetOf(session);
  saveForLater(session.id, "decide", held.productId, held.variantId);
}

/** "End without buying" with no option on screen: keeps the product the decision holds. */
export function endWithNothingChosen(session: DecisionSession): void {
  endWithoutBuying(session.id, "decide", checkoutTargetOf(session).productId);
}
