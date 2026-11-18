"use client";

import { useRouter } from "next/navigation";
import { dispatch } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { now } from "@/pica/features/shared/format";
import { doneHref } from "@/pica/features/shared/journey";
import { recordPurchase } from "./actions";
import { returnCheckOf } from "./done-model";

/**
 * "Did you buy it?" after the buyer went to the merchant's checkout. The app
 * has no order access, so the buyer's answer is all it knows. Null when there
 * is nothing to ask.
 */
export function useReturnCheck(session: DecisionSession, goToDone: boolean) {
  const router = useRouter();
  const check = returnCheckOf(session);
  if (!check) return null;

  return {
    product: check.product,
    /** "Yes, I bought it": `purchase_completed` fires once, from `recordPurchase`. */
    bought() {
      recordPurchase(session.id);
      if (goToDone) router.push(doneHref(session.id));
    },
    /** "Not yet": the question goes until the buyer starts checkout again. */
    notYet() {
      dispatch(session.id, { type: "checkout_answered", bought: false, at: now() });
    },
  };
}
