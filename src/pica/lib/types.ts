/**
 * Shared contracts for Shop Companion.
 *
 * Every part of the app builds against these types. Change them only through
 * the lead, because four owners depend on them.
 *
 * Trust rules these types enforce:
 * - Prices, images, ratings, variants and stock come from catalog records only.
 *   The model refers to products by ID and never writes those facts itself.
 * - Each canvas item says whether the buyer stated it or Pica inferred it.
 * - Each piece of evidence says where it came from (`EvidenceBasis`).
 */

export type Category = "bag" | "backpack" | "luggage";

export const CATEGORIES: readonly Category[] = ["bag", "backpack", "luggage"];

/* ------------------------------------------------------------------ */
/* Catalog (normalized from Shopify Global Catalog MCP)                */
/* ------------------------------------------------------------------ */

/** Amount in minor units (cents for USD), as the catalog returns it. */
export interface Money {
  amount: number;
  currency: string;
}

export interface CatalogImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface CatalogSeller {
  /** `gid://shopify/Shop/…` */
  id: string;
  name: string;
  /** The merchant's storefront URL. */
  url?: string;
  /** The `*.myshopify.com` domain, used for the Checkout MCP endpoint. */
  domain?: string;
  /** Policy links the catalog gives (privacy, refund, terms…). */
  links: { type: string; url: string }[];
}

export interface CatalogOptionValue {
  label: string;
  /** Null when the catalog does not say. */
  available: boolean | null;
}

export interface CatalogOption {
  name: string;
  values: CatalogOptionValue[];
}

export interface CatalogVariant {
  /** `gid://shopify/ProductVariant/…` */
  id: string;
  title: string;
  price: Money;
  /** Compare-at price, when the merchant set one. */
  listPrice?: Money;
  /** Null when the catalog does not say. Never guess. */
  available: boolean | null;
  options: { name: string; label: string }[];
  /** Merchant product page for this variant. Keep attribution params intact. */
  url?: string;
  /** Direct checkout link from the catalog. Keep it byte-for-byte. */
  checkoutUrl?: string;
  image?: CatalogImage;
}

export interface CatalogProduct {
  /** `gid://shopify/p/…` */
  id: string;
  title: string;
  /**
   * Merchant-written description as plain text (HTML decoded and stripped).
   * This is the only free text that may be shown as "Merchant says".
   */
  descriptionText: string;
  images: CatalogImage[];
  seller: CatalogSeller;
  priceRange: { min: Money; max: Money };
  /** Rating as the catalog reports it. Absent when there is none. */
  rating?: { value: number; count: number; scaleMax: number };
  options: CatalogOption[];
  /**
   * Variants we have fetched. Search returns one (the matched variant).
   * `getProduct` with `selected` options returns the chosen one.
   */
  variants: CatalogVariant[];
  /**
   * Fields Shopify generates from the listing (`metadata.*`). Useful, but
   * not merchant text. Show as "From the listing, summarized by Shopify".
   */
  summarized: {
    sellingPoints: string[];
    features: string[];
    specs: string[];
  };
  /** Epoch ms. Price and stock go stale after 10 minutes (Shopify's rule). */
  fetchedAt: number;
}

export interface CatalogSearchParams {
  query: string;
  category?: Category;
  /** Whole US dollars. */
  minPriceUsd?: number;
  maxPriceUsd?: number;
  cursor?: string;
  /** 1–10. Default 10. */
  limit?: number;
}

export interface CatalogSearchResult {
  /** USD products that ship to the US only. May be empty. */
  products: CatalogProduct[];
  /** The catalog's estimate. Null when it gives none. */
  totalCount: number | null;
  nextCursor: string | null;
}

/* ------------------------------------------------------------------ */
/* Errors shared by all API routes                                     */
/* ------------------------------------------------------------------ */

export type ApiErrorCode =
  | "bad_request"
  | "not_found"
  | "variant_unavailable"
  | "rate_limited"
  | "catalog_unavailable"
  | "checkout_unavailable"
  | "model_unavailable"
  | "missing_key"
  | "bad_key"
  | "unknown";

/** Every API route answers errors as `{ error: ApiError }` with a 4xx/5xx status. */
export interface ApiError {
  code: ApiErrorCode;
  /** Buyer-facing sentence in Shop's voice: what happened, then the fix. */
  message: string;
  retryAfterSeconds?: number;
}

/* ------------------------------------------------------------------ */
/* Decision canvas (FR-03)                                             */
/* ------------------------------------------------------------------ */

/** `stated` = the buyer said it. `inferred` = Pica's guess, shown as such. */
export type Source = "stated" | "inferred";

export type CanvasItemKind = "must_have" | "preference" | "open_question";

export interface CanvasItem {
  id: string;
  kind: CanvasItemKind;
  text: string;
  source: Source;
}

export interface Canvas {
  category: Category | null;
  outcome: { text: string; source: Source } | null;
  /** Whole US dollars. */
  budget: { minUsd?: number; maxUsd?: number; source: Source } | null;
  items: CanvasItem[];
}

export const EMPTY_CANVAS: Canvas = {
  category: null,
  outcome: null,
  budget: null,
  items: [],
};

/* ------------------------------------------------------------------ */
/* Shortlist, comparison, evidence (FR-05, FR-06, FR-07)               */
/* ------------------------------------------------------------------ */

/**
 * Where a claim comes from. The UI shows each differently, in words:
 * - `merchant`: the merchant's listing → "Merchant says"
 * - `catalog_summary`: Shopify's generated summary of the listing
 * - `inference`: Pica's reasoning → "Pica's read"
 * - `missing`: nobody has told us → "Not verified"
 */
export type EvidenceBasis = "merchant" | "catalog_summary" | "inference" | "missing";

export interface ShortlistEntry {
  productId: string;
  /** What sets this one apart from the others, e.g. "The lighter option". No superlatives. */
  angle: string;
  /** Pica's read: why it fits this buyer's stated priorities. */
  whyItFits: string[];
  /** Pica's read: why this buyer might not want it. At least one. */
  whyNot: string[];
  /** What the price buys, or fails to buy, against the others. */
  valueNote: string;
  /** Things that matter to this buyer that the listing does not confirm. */
  unverified: string[];
}

export interface Shortlist {
  entries: ShortlistEntry[];
  /** Pica's short framing of the set, including reasons to wait or not buy. */
  note: string;
  createdAt: number;
  /** True once the canvas changed after this shortlist was made. */
  stale: boolean;
}

export interface ComparisonCell {
  productId: string;
  note: string;
  /**
   * `merchant` and `catalog_summary` hold only when the server found `quote`
   * in the listing. Otherwise the server sets `inference`.
   */
  basis: EvidenceBasis;
  /** Words copied from the listing that back the note. Checked by the server. */
  quote?: string;
}

export interface ComparisonRow {
  /** A buyer priority, e.g. "Fits a 16-inch laptop". */
  priority: string;
  cells: ComparisonCell[];
}

export interface Comparison {
  productIds: string[];
  rows: ComparisonRow[];
  /** The main tradeoff in a sentence or two. Not a verdict. */
  takeaway: string;
  createdAt: number;
  stale: boolean;
}

/* ------------------------------------------------------------------ */
/* Chat: request body and tool payloads                                */
/* ------------------------------------------------------------------ */

/** A question Pica asks through the `ask_question` tool. Always skippable. */
export interface PicaQuestion {
  question: string;
  /** Why the answer changes which product suits the buyer. */
  why: string;
  /** 2–4 quick answers. The buyer may also type their own or skip. */
  options: string[];
}

/** Names of the model's tools. The client switches on these in tool parts. */
export const PICA_TOOLS = {
  updateCanvas: "update_canvas",
  askQuestion: "ask_question",
  searchCatalog: "search_catalog",
  presentShortlist: "present_shortlist",
  compareProducts: "compare_products",
} as const;

/** Tool outputs the client applies to the session when a tool part completes. */
export interface UpdateCanvasOutput {
  canvas: Canvas;
}
export interface AskQuestionOutput {
  question: PicaQuestion;
}
export interface SearchCatalogOutput {
  products: CatalogProduct[];
  totalCount: number | null;
  /** Set when the search failed or found nothing, in Pica's voice. */
  problem?: ApiError;
}
export interface PresentShortlistOutput {
  shortlist: Shortlist;
}
export interface CompareProductsOutput {
  comparison: Comparison;
}

/**
 * Body of `POST /api/chat`, sent beside the AI SDK `messages`.
 * The server holds no session state, so the client sends what Pica needs.
 */
export interface ChatSessionContext {
  sessionId: string;
  canvas: Canvas;
  /** Every catalog product fetched so far in this session. */
  products: CatalogProduct[];
  shortlistProductIds: string[];
  /** True when the canvas changed after the last shortlist, by the buyer's edit or Pica's update. */
  canvasChangedSinceShortlist: boolean;
}

/* ------------------------------------------------------------------ */
/* Checkout (FR-08)                                                    */
/* ------------------------------------------------------------------ */

export interface CheckoutRequest {
  productId: string;
  variantId: string;
  quantity: number;
  sellerDomain?: string;
  /** The catalog's direct checkout link for this variant, used as fallback. */
  checkoutUrl?: string;
}

export interface CheckoutTotals {
  subtotal: Money;
  shipping?: Money;
  tax?: Money;
  total: Money;
}

export interface CheckoutResponse {
  /**
   * `ucp`: we created a UCP checkout and have the merchant's totals.
   * `direct`: we hand off with the catalog's checkout link; shipping and tax
   * show at the merchant.
   */
  mode: "ucp" | "direct";
  /** https only. The buyer opens this to finish at the merchant. Never log it. */
  continueUrl: string;
  /**
   * How many the checkout holds. In `direct` mode the catalog link fixes this
   * at 1, whatever the request asked for. Show this number, not the request's.
   */
  quantity: number;
  totals?: CheckoutTotals;
  expiresAt?: string;
}

/* ------------------------------------------------------------------ */
/* Decision session (FR-09, FR-10) — stored in the browser             */
/* ------------------------------------------------------------------ */

export type DecisionStatus = "open" | "saved" | "bought" | "declined";

export interface Decision {
  status: DecisionStatus;
  productId?: string;
  variantId?: string;
  decidedAt?: number;
  /** Optional reason the buyer gave for not buying or waiting. */
  reason?: string;
}

/** The three-question check that feeds Confident Decision Rate. */
export interface ConfidenceCheck {
  understandNeeds: boolean;
  canExplainTradeoffs: boolean;
  confidentInChoice: boolean;
  submittedAt: number;
}

export interface OutcomeFeedback {
  satisfied: "yes" | "partly" | "no";
  /** One answer per must-have from the canvas. Null = not sure yet. */
  requirements: { itemId: string; text: string; met: boolean | null }[];
  note?: string;
  submittedAt: number;
}

export interface DecisionSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Short title for the saved list, taken from the first message. */
  title: string;
  canvas: Canvas;
  /** AI SDK `UIMessage[]`, kept opaque here so this file has no SDK import. */
  messages: unknown[];
  /**
   * Tool calls whose output is already applied to this session. Stops a
   * reload from re-applying an old canvas over the buyer's later edits.
   */
  appliedToolCallIds: string[];
  /** Catalog records fetched in this session, by product ID. */
  products: Record<string, CatalogProduct>;
  shortlist: Shortlist | null;
  comparison: Comparison | null;
  decision: Decision;
  checkoutStartedAt?: number;
  confidence?: ConfidenceCheck;
  outcome?: OutcomeFeedback;
  /**
   * A scripted demo from Home: replies come from the demo script, not the
   * server, and it stops before Decide. Missing on live decisions.
   */
  demo?: true;
}
