/**
 * Decide's state and how it changes. Pure: the clock comes in as `at`, and
 * requests go out as commands the hook runs.
 *
 * Checkout takes two steps (brief 6.6):
 * 1. Before the press nothing asks the merchant. The screen shows the price.
 * 2. The press asks the server to start a checkout. `ucp` with totals sends
 *    back the merchant's costs (and maybe an expiry): the screen shows them and
 *    the main button turns into "Go to {merchant} to pay". Anything else
 *    (`direct`) sends the buyer straight to the merchant.
 * Changing a choice drops the costs and goes back to step 1, and step 2 waits
 * until the new choice has loaded. A stale price is checked again before step
 * 2 can start. Paying on a quote past its expiry goes back to step 1 as well.
 */
import type {
  ApiError,
  CatalogProduct,
  CatalogVariant,
  CheckoutRequest,
  CheckoutResponse,
} from "@/pica/lib/types";
import type { StockState } from "@/pica/features/shared/format";
import { afterLoad, needsRecheck, RECHECK_GAP_MS, sameSelection, type Selected } from "./checks";
import { nextSelection } from "./selection";

export type Load =
  | { state: "loading" }
  | { state: "ready"; product: CatalogProduct }
  | { state: "failed"; error: ApiError; status: number };

export type CheckoutState =
  | { state: "idle" }
  | { state: "busy" }
  | { state: "failed"; error: ApiError }
  /** `receivedAt`: when the costs arrived, by the buyer's clock. In memory only. */
  | { state: "review"; result: CheckoutResponse; receivedAt: number };

/**
 * Why the shown choice is not the one asked for.
 * - `revert`: a new choice has no variant; the earlier choice is back.
 * - `gone`: the choice already shown is sold out or no longer listed.
 */
export type ChoiceProblem = "revert" | "gone";

export interface DecideState {
  load: Load;
  selected: Selected | undefined;
  checkout: CheckoutState;
  /** The press found the price old and asked for it again. */
  rechecking: boolean;
  /** That recheck came back: say so until the buyer chooses again. */
  rechecked: boolean;
  choiceProblem: ChoiceProblem | null;
  /** The last product shown and the choice it was loaded for. */
  lastGood: { product: CatalogProduct; selected: Selected | undefined } | null;
  /** When the shown product loaded, by the buyer's clock. See `needsRecheck`. */
  loadedAt: number | null;
  /**
   * The quote ran out and its costs went: the screen can say why. Cleared on
   * the next press or choice.
   */
  quoteRanOut: boolean;
}

const IDLE: CheckoutState = { state: "idle" };

export function initialDecideState(selected: Selected | undefined): DecideState {
  return {
    load: { state: "loading" },
    selected,
    checkout: IDLE,
    rechecking: false,
    rechecked: false,
    choiceProblem: null,
    lastGood: null,
    loadedAt: null,
    quoteRanOut: false,
  };
}

/** The product route answered for `selection`. */
export function loaded(
  state: DecideState,
  result: { ok: true; product: CatalogProduct } | { ok: false; error: ApiError; status: number },
  selection: Selected | undefined,
  at: number,
): DecideState {
  const recheck = state.rechecking ? { rechecking: false, rechecked: result.ok } : {};
  if (!result.ok) return { ...state, ...recheck, load: { state: "failed", error: result.error, status: result.status } };
  const fetched = result.product;
  const next = afterLoad(fetched, selection, state.lastGood);
  if (next.kind === "revert") {
    // Keep the last good product on screen and go back to its choice.
    return { ...state, ...recheck, choiceProblem: "revert", selected: next.to };
  }
  const gone = next.kind === "gone";
  return {
    ...state,
    ...recheck,
    // The choice line stays up until the buyer chooses again: `choose` clears it.
    ...(gone ? { choiceProblem: "gone" as const, selected: next.to, checkout: IDLE } : {}),
    lastGood: { product: fetched, selected: gone ? next.to : selection },
    loadedAt: at,
    load: { state: "ready", product: fetched },
  };
}

/** "Try again" after the product failed to load. */
export function retryLoad(state: DecideState): DecideState {
  return { ...state, load: { state: "loading" } };
}

/** The buyer picked `label` for option `name`. Costs from the old choice go. */
export function choose(state: DecideState, shown: CatalogVariant, name: string, label: string): DecideState {
  return {
    ...state,
    rechecked: false,
    choiceProblem: null,
    quoteRanOut: false,
    checkout: IDLE,
    selected: nextSelection(shown, state.selected, name, label),
  };
}

/**
 * The buyer changed a choice and its price and stock have not come back yet.
 * The product on screen is still the old choice's, so checkout must wait.
 */
export function choicePending(state: Pick<DecideState, "load" | "selected" | "lastGood">): boolean {
  return state.load.state === "ready" && !sameSelection(state.selected, state.lastGood?.selected);
}

/** What the press of "Continue to checkout" asks the hook to do. */
export type PressCommand = { kind: "none" } | { kind: "recheck" } | { kind: "post"; body: CheckoutRequest };

/**
 * The fields a press sets. The hook applies them to the latest state through
 * an updater (`withChange`), so a load result queued just before the press is
 * kept. `state` is the same change applied to the state pressed on.
 */
export type PressChange = Partial<Pick<DecideState, "checkout" | "rechecking" | "rechecked" | "quoteRanOut">>;

export function press(
  state: DecideState,
  at: number,
): { state: DecideState; change: PressChange; command: PressCommand } {
  const nothing = { state, change: {}, command: { kind: "none" as const } };
  if (state.load.state !== "ready" || choicePending(state)) return nothing;
  const product = state.load.product;
  const variant = product.variants[0];
  if (!variant) return nothing;
  if (needsRecheck(product.fetchedAt, at, state.loadedAt)) {
    const change: PressChange = { rechecked: false, rechecking: true, quoteRanOut: false };
    return { state: withChange(state, change), change, command: { kind: "recheck" } };
  }
  const change: PressChange = { checkout: { state: "busy" }, quoteRanOut: false };
  return { state: withChange(state, change), change, command: { kind: "post", body: checkoutRequest(product, variant) } };
}

/** Apply only the fields a press changed, leaving the rest of `state` as it is now. */
export function withChange(state: DecideState, change: PressChange): DecideState {
  return Object.keys(change).length === 0 ? state : { ...state, ...change };
}

/** The body for `POST /api/checkout`. Always one item: the catalog's direct link holds one. */
export function checkoutRequest(product: CatalogProduct, variant: CatalogVariant): CheckoutRequest {
  return {
    productId: product.id,
    variantId: variant.id,
    quantity: 1,
    sellerDomain: product.seller.domain,
    checkoutUrl: variant.checkoutUrl,
  };
}

/**
 * The server answered the checkout request: the new checkout state, or the
 * merchant's page to go to now (the button stays busy as the page leaves).
 * `ucp` without totals has nothing to show, so it goes straight out like `direct`.
 * `at` is when the answer arrived, by the buyer's clock; see `quoteExpired`.
 */
export function checkoutAnswered(
  result: { ok: true; data: CheckoutResponse } | { ok: false; error: ApiError },
  at: number,
): { checkout: CheckoutState; leaveTo: null } | { checkout: null; leaveTo: string } {
  if (!result.ok) return { checkout: { state: "failed", error: result.error }, leaveTo: null };
  if (result.data.mode === "ucp" && result.data.totals) {
    return { checkout: { state: "review", result: result.data, receivedAt: at }, leaveTo: null };
  }
  return { checkout: null, leaveTo: result.data.continueUrl };
}

/**
 * The checkout answer came back for the variant posted. `latest` is the state
 * now, not the one pressed on: a refetch may have swapped the product since
 * (the shown choice was gone), or a new choice may be loading. Then the answer
 * belongs to a variant no longer on screen: drop it and free the button.
 * Otherwise apply it as `checkoutAnswered` says: show the costs, show the
 * error, or leave for the merchant.
 */
export function answerCheckout(
  latest: DecideState,
  postedVariantId: string,
  result: { ok: true; data: CheckoutResponse } | { ok: false; error: ApiError },
  at: number,
): { change: PressChange; leaveTo: string | null } {
  const shown = latest.load.state === "ready" ? latest.load.product.variants[0] : undefined;
  if (!shown || shown.id !== postedVariantId || choicePending(latest)) {
    return { change: latest.checkout.state === "busy" ? { checkout: IDLE } : {}, leaveTo: null };
  }
  const outcome = checkoutAnswered(result, at);
  if (outcome.checkout) return { change: { checkout: outcome.checkout }, leaveTo: null };
  return { change: {}, leaveTo: outcome.leaveTo };
}

/**
 * True when the merchant's quote has run out. The expiry is the server's time
 * and `at` is the buyer's clock, which may be wrong, so a quote counts as run
 * out only when all three hold:
 * - its expiry has passed by the buyer's clock;
 * - it had not passed when the quote arrived. A quote that looks run out the
 *   moment it lands means the clock is ahead: let the merchant judge it, or
 *   every fresh quote would run out at once and checkout would loop;
 * - the quote has been on screen longer than `RECHECK_GAP_MS`, so a clock
 *   a little ahead cannot take fresh costs away.
 * A quote with no expiry, or one that does not parse, has not run out: the
 * merchant checks it again when the buyer arrives.
 */
export function quoteExpired(checkout: CheckoutState, at: number): boolean {
  if (checkout.state !== "review" || !checkout.result.expiresAt) return false;
  const expires = Date.parse(checkout.result.expiresAt);
  if (!Number.isFinite(expires)) return false;
  return expires <= at && expires > checkout.receivedAt && at - checkout.receivedAt > RECHECK_GAP_MS;
}

/** What the press of "Go to {merchant} to pay" asks the hook to do. */
export type PayCommand = { kind: "none" } | { kind: "leave"; url: string };

/**
 * The second step's press. A live quote sends the buyer to the merchant. An
 * expired one must not: its link and costs are old, so the costs go and the
 * button goes back to step 1, where the next press fetches fresh ones.
 * `quoteRanOut` says so, for the screen to explain why the costs went.
 */
export function payPress(state: DecideState, at: number): { change: PressChange; command: PayCommand } {
  if (state.checkout.state !== "review") return { change: {}, command: { kind: "none" } };
  if (quoteExpired(state.checkout, at)) {
    return { change: { checkout: IDLE, quoteRanOut: true }, command: { kind: "none" } };
  }
  return { change: {}, command: { kind: "leave", url: state.checkout.result.continueUrl } };
}

/** What the press of "Save for later" asks the hook to do. */
export type SaveCommand = { kind: "none" } | { kind: "save"; productId: string; variantId: string | undefined };

/** What the decision already holds: `checkoutTargetOf(session)`. */
export interface HeldChoice {
  productId?: string;
  variantId?: string;
}

/**
 * "Save for later" saves the product and the variant on screen. While a new
 * choice loads, the variant on screen is the old choice's, so the press waits
 * like Continue does. Before the product loads (or when it failed), nothing
 * is on screen: it keeps the variant the decision already holds for this
 * product, so a save never forgets a size or colour.
 */
export function savePress(state: DecideState, productId: string, held: HeldChoice): SaveCommand {
  if (choicePending(state)) return { kind: "none" };
  if (state.load.state === "ready") {
    const product = state.load.product;
    return { kind: "save", productId: product.id, variantId: product.variants[0]?.id };
  }
  return { kind: "save", productId, variantId: held.productId === productId ? held.variantId : undefined };
}

/** The buyer left the page, or came back to it from the merchant: free a busy button. */
export function freeCheckout(state: DecideState): DecideState {
  return state.checkout.state === "busy" ? { ...state, checkout: IDLE } : state;
}

/** The merchant's costs, once a `ucp` checkout sent them. */
export function costsOf(checkout: CheckoutState) {
  if (checkout.state !== "review" || !checkout.result.totals) return undefined;
  return { totals: checkout.result.totals, expiresAt: checkout.result.expiresAt };
}

/** Show what the checkout holds, not what was asked for: before a review that is 1. */
export function shownQuantity(checkout: CheckoutState): number {
  return checkout.state === "review" ? checkout.result.quantity : 1;
}

/** Checkout can start only with a variant that is not sold out. Unknown stock may go on. */
export function canStartCheckout(variant: CatalogVariant | undefined, stock: StockState): boolean {
  return Boolean(variant) && stock !== "sold_out";
}

/** Which step the main button is on. */
export type PrimaryStep = "start" | "recheck" | "busy" | "pay";

export function primaryStep(state: DecideState): PrimaryStep {
  if (state.checkout.state === "review") return "pay";
  if (state.rechecking) return "recheck";
  if (state.checkout.state === "busy" || choicePending(state)) return "busy";
  return "start";
}

/** The brief's words for the main button (6.6). */
export function primaryLabel(step: PrimaryStep, merchant: string): string {
  switch (step) {
    case "pay":
      return `Go to ${merchant} to pay`;
    case "recheck":
      return "Checking price and stock again";
    case "busy":
    case "start":
      return "Continue to checkout";
  }
}
