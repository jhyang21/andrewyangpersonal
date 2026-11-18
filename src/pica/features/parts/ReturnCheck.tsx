"use client";

import { Button, Card } from "@/pica/components/kit";
import { Pica } from "@/pica/components/mascot";
import type { DecisionSession } from "@/pica/lib/types";
import { useReturnCheck } from "@/pica/features/decision/useReturnCheck";

export const RETURN_CHECK = {
  heading: "Did you buy it?",
  yes: "Yes, I bought it",
  notYet: "Not yet",
} as const;

/** "You went to North Trail Supply to check out for the Commuter Pack 24L. Pica can't see orders, ..." */
export function returnCheckText(merchant: string | null, productTitle: string | null): string {
  const where = merchant ?? "the merchant";
  const what = productTitle ? ` for the ${productTitle}` : "";
  return `You went to ${where} to check out${what}. Pica can't see orders, so your answer is all it has.`;
}

export interface ReturnCheckViewProps {
  merchant: string | null;
  productTitle: string | null;
  onBought: () => void;
  onNotYet: () => void;
  /** h1 when the card is the page's main content, as on Done. Default h2. */
  headingLevel?: "h1" | "h2" | "h3" | "h4";
  className?: string;
}

/** The card with no store, for the parts page. Screens use `ReturnCheck`. */
export function ReturnCheckView({
  merchant,
  productTitle,
  onBought,
  onNotYet,
  headingLevel: Heading = "h2",
  className,
}: ReturnCheckViewProps) {
  return (
    <Card as="section" padding="md" shadow className={["flex flex-col gap-3", className ?? ""].join(" ").trim()}>
      <div className="flex items-center gap-3">
        <Pica pose="idle" size={32} />
        <Heading className="min-w-0 text-heading font-semibold text-ink">{RETURN_CHECK.heading}</Heading>
      </div>
      <p className="text-body-lg text-ink">{returnCheckText(merchant, productTitle)}</p>
      {/* Two plain answers, the same size. There is no "No": End without buying is for that. */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onBought}>{RETURN_CHECK.yes}</Button>
        <Button onClick={onNotYet}>{RETURN_CHECK.notYet}</Button>
      </div>
    </Card>
  );
}

export interface ReturnCheckProps {
  session: DecisionSession;
  /** Go to Done after "Yes, I bought it". Default true; Done itself passes false. */
  goToDone?: boolean;
  headingLevel?: "h1" | "h2" | "h3" | "h4";
  className?: string;
}

/**
 * "Did you buy it?" after the buyer went to the merchant's checkout. Renders
 * nothing when there is no checkout to ask about. "Yes" sends
 * `purchase_completed` once, through `recordPurchase`; "Not yet" puts the
 * question away until the next checkout.
 */
export function ReturnCheck({ session, goToDone = true, headingLevel, className }: ReturnCheckProps) {
  const check = useReturnCheck(session, goToDone);
  if (!check) return null;
  return (
    <ReturnCheckView
      merchant={check.product?.seller.name ?? null}
      productTitle={check.product?.title ?? null}
      onBought={check.bought}
      onNotYet={check.notYet}
      headingLevel={headingLevel}
      className={className}
    />
  );
}
