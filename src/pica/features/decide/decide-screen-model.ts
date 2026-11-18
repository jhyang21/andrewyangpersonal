/**
 * The Decide screen's words and the small rules behind what it shows. Pure:
 * no React, no clock. The state itself lives in decide-model.ts.
 */
import { checkoutTargetOf } from "@/pica/lib/session";
import type { ApiError, CheckoutTotals, DecisionSession, DecisionStatus, ShortlistEntry } from "@/pica/lib/types";
import { formatMoney } from "@/pica/components/kit";
import { journeyHref } from "@/pica/features/shared/journey";
import { policyLabel, sortedPolicyLinks, type StockState } from "@/pica/features/shared/format";
import type { ChoiceProblem, Load } from "./decide-model";

export const DECIDE = {
  back: "Back to your options",
  chooseOption: "Choose an option",
  noOption: "Pick one of your options, then look it over here before you buy.",
  tradeoff: "The tradeoff",
  goal: "Your goal",
  whyFits: "Why it fits you",
  whyNot: "Why you might not want it",
  // Options' words for a missing line, without its "Ask Pica": Decide has no chat.
  noFit: "Pica gave no reason here.",
  noWhyNot: "Pica listed no drawback.",
  noRead: "This one isn't among your options, so Pica hasn't weighed it up.",
  seeEvidence: "See the evidence",
  choice: "Your choice",
  cost: "Cost",
  beforeCosts: "Shipping and tax show at the next step.",
  policies: "Store policies",
  rechecked: "Price and stock were checked again. Look them over, then continue.",
  save: "Save for later",
  end: "End without buying",
  seeEnding: "See how this ended",
  notListed: "Price not listed",
  loading: "Loading price and stock",
} as const;

/**
 * The product Decide may show, or null for "Choose an option". The address
 * is not trusted: the product must be one of the decision's options, or the
 * one the buyer already decided on or took to checkout.
 */
export function decideTarget(session: DecisionSession, productId: string | undefined): string | null {
  if (!productId) return null;
  const onShortlist = entryOf(session, productId) !== null;
  const held = session.decision.productId === productId || checkoutTargetOf(session).productId === productId;
  return onShortlist || held ? productId : null;
}

/**
 * Checkout, "Save for later" and "End without buying" show while the
 * decision is open or saved. An ended one (bought, or ended without buying)
 * shows "See how this ended" instead (brief 6.6).
 */
export function showsEndActions(status: DecisionStatus): boolean {
  return status === "open" || status === "saved";
}

/**
 * Where focus goes when the product load changes, if it fell to the page body.
 * "Try again" goes with the error notice, so focus moves to the busy
 * "Continue to checkout" that takes its place, or to "See how this ended"
 * on an ended decision, which has no Continue. A failed load removes
 * Continue; if focus was on it, it moves to "Save for later", the first
 * action still on screen. Focus anywhere else stays put.
 */
export function focusAfterLoad({
  load,
  live,
  retried,
  wasOnContinue,
  focusLost,
}: {
  load: Load["state"];
  /** Open or saved: the decision shows Continue, not "See how this ended". */
  live: boolean;
  retried: boolean;
  wasOnContinue: boolean;
  focusLost: boolean;
}): "continue" | "ending" | "save" | null {
  if (!focusLost) return null;
  if (load === "loading" && retried) return live ? "continue" : "ending";
  if (load === "failed" && wasOnContinue) return "save";
  return null;
}

/** Where "Back to your options" and "Choose an option" go. */
export function optionsHref(sessionId: string): string {
  return journeyHref(sessionId, { kind: "workspace", view: "options", needsOpen: false });
}

/** The words beside the price for the shown choice's stock (brief section 7). */
export function stockLine(stock: StockState): string {
  switch (stock) {
    case "in_stock":
      return "In stock";
    case "sold_out":
      return "This choice is sold out. Pick another size or colour, or another option.";
    case "unknown":
      return "Stock not confirmed. You can still continue; the merchant confirms at checkout.";
  }
}

/** The banner for a choice that could not be shown. Sent with `error_shown`, as before. */
export function choiceProblemError(problem: ChoiceProblem): ApiError {
  return {
    code: "variant_unavailable",
    message:
      problem === "revert"
        ? "That size or colour isn't available. Your earlier choice is still selected."
        : "The size or colour you chose before is sold out or no longer listed. Choose another below.",
  };
}

/** One side of the tradeoff. `given` is false when Pica wrote nothing and the line is the fallback. */
export interface TradeoffLine {
  text: string;
  given: boolean;
}

/**
 * Pica's two lines from the shortlist, or null when the product has no entry.
 * Both sides always show: a missing one gets a plain line, as on Options.
 */
export function tradeoffOf(entry: ShortlistEntry | null): { fits: TradeoffLine; not: TradeoffLine } | null {
  if (!entry) return null;
  const line = (text: string | undefined, fallback: string): TradeoffLine =>
    text ? { text, given: true } : { text: fallback, given: false };
  return { fits: line(entry.whyItFits[0], DECIDE.noFit), not: line(entry.whyNot[0], DECIDE.noWhyNot) };
}

export function entryOf(session: DecisionSession, productId: string): ShortlistEntry | null {
  return session.shortlist?.entries.find((entry) => entry.productId === productId) ?? null;
}

/** The merchant's policy links, refund and shipping first. Https only. */
export function policyLinks(links: { type: string; url: string }[]): { label: string; url: string }[] {
  return sortedPolicyLinks(links).map((link) => ({ label: policyLabel(link.type), url: link.url }));
}

export function noPolicyText(merchant: string): string {
  return `The catalog lists no return or shipping policy for ${merchant}.`;
}

export function handoffText(merchant: string): string {
  return `You buy from ${merchant} on their site. Nothing is bought until you pay there.`;
}

/** The cost card's rows, as the merchant gave them. A cost it left out shows at its checkout. */
export function costRows(totals: CheckoutTotals, merchant: string): { label: string; value: string; total: boolean }[] {
  const atMerchant = `Shown at ${merchant}`;
  return [
    { label: "Subtotal", value: formatMoney(totals.subtotal), total: false },
    { label: "Shipping", value: totals.shipping ? formatMoney(totals.shipping) : atMerchant, total: false },
    { label: "Tax", value: totals.tax ? formatMoney(totals.tax) : atMerchant, total: false },
    { label: "Total", value: formatMoney(totals.total), total: true },
  ];
}

/** "These costs hold until 3:40 PM." Null with no expiry, or one that does not parse. */
export function quoteUntilText(expiresAt: string | undefined): string | null {
  if (!expiresAt) return null;
  const at = Date.parse(expiresAt);
  if (!Number.isFinite(at)) return null;
  const time = new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `These costs hold until ${time}.`;
}

export function quoteRanOutText(merchant: string): string {
  return `The costs from ${merchant} ran out, so they were cleared. Continue to checkout to get new ones.`;
}

/** The checkout holds more than one: say so. Null for one. */
export function quantityNote(quantity: number, merchant: string): string | null {
  if (quantity === 1) return null;
  return `${merchant}'s checkout holds ${quantity} of this item, not 1. Change the amount there before you pay.`;
}

/**
 * What the hidden status line says after a press: the costs came, they ran
 * out, or the price was checked again. Empty otherwise, so nothing is read on load.
 */
export function pressAnnouncement(
  state: { costs?: { totals: CheckoutTotals }; quoteRanOut: boolean; rechecked: boolean; quantity: number },
  merchant: string,
): string {
  if (state.costs) {
    const costs = `${merchant} sent the costs. Total ${formatMoney(state.costs.totals.total)}.`;
    const quantity = quantityNote(state.quantity, merchant);
    return quantity ? `${costs} ${quantity}` : costs;
  }
  if (state.quoteRanOut) return quoteRanOutText(merchant);
  if (state.rechecked) return DECIDE.rechecked;
  return "";
}
