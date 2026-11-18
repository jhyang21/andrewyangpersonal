/**
 * Pica's fixed numbers and buyer-facing strings. Safe to import on the client:
 * nothing here touches the model, the catalog or the system prompt.
 */
/** The OpenAI model behind Pica and the Decisions helper. */
export const PICA_MODEL_ID = "gpt-6-luna";

/**
 * The request header that carries the visitor's OpenAI key to `/api/chat`.
 * The browser sets it from the key kept in its tab; the server reads it per
 * request and keeps nothing.
 */
export const OPENAI_KEY_HEADER = "x-openai-key";

/** An OpenAI key's shape: sk-, then 17 to 197 more characters, no spaces. */
export const OPENAI_KEY_SHAPE = /^sk-\S{17,197}$/;

/**
 * Pica asks at most this many questions before each shortlist. The count
 * starts again after every shortlist it shows.
 */
export const MAX_QUESTIONS = 4;

/** A shortlist holds this many entries, fewer only when the catalog gave fewer fits. */
export const SHORTLIST_MIN = 3;
export const SHORTLIST_MAX = 5;

/** A comparison covers 2 to 5 products. */
export const COMPARE_MIN = 2;
export const COMPARE_MAX = 5;

/** Most model steps in one request (tool calls plus the closing reply). */
export const MAX_STEPS = 8;

/** Time limit for one Decisions call. Past this, Pica carries on without it. */
export const DECISION_TIMEOUT_MS = 1500;

/** Longest merchant description the model sees, in characters. */
export const DIGEST_DESCRIPTION_CHARS = 600;

/** Longest quote a comparison cell may carry, in characters (about 20 words). */
export const COMPARE_QUOTE_MAX_CHARS = 200;

/** Size limits on one `POST /api/chat` request. */
export const CHAT_LIMITS = {
  /**
   * Whole request body, in bytes. Room for 200 session products plus the
   * full catalog records that search results carry in the history.
   */
  bodyBytes: 4_000_000,
  /** Messages in the history. */
  messages: 200,
  /** Text in one message, buyer's or Pica's, in characters. */
  messageChars: 4_000,
  /** The whole message history, in bytes, apart from the session's products. */
  historyBytes: 2_000_000,
  /** Products the session may list. */
  products: 200,
  /** Shortlist IDs the session may list. */
  shortlistIds: 10,
  /** Items on the canvas. */
  canvasItems: 50,
  /** IDs: session, products, sellers, canvas items. */
  idChars: 200,
  /** Canvas outcome and item texts. */
  canvasTextChars: 400,
  /** Product title, seller name, option names and labels. */
  nameChars: 300,
  /** Option groups and values per group on one product. */
  options: 20,
  optionValues: 50,
  /** Each Shopify summary list and each line in it. */
  summaryItems: 30,
  summaryItemChars: 500,
  /** Merchant descriptions past this are cut, not rejected. The model sees far less. */
  descriptionChars: 4_000,
  /** Any other string in the session, such as image and variant URLs. */
  otherStringChars: 4_000,
} as const;

/** Requests one client (by IP) may send to `/api/chat` in one window. */
export const CHAT_RATE_LIMIT = {
  requests: 30,
  windowMs: 5 * 60 * 1000,
  /** Past this many tracked clients, drop the ones whose window ended. */
  maxTrackedClients: 5_000,
} as const;

/**
 * Buyer-facing messages. Each says what happened, then what to do.
 * Shop's voice: short, plain, sentence case, no codes.
 */
export const PICA_MESSAGES = {
  missingKey: "Pica isn't set up yet. Add your OpenAI key on Home, or try the demo.",
  /** OpenAI turned down the key the visitor's tab sent. */
  badKey: "Pica can't reply. OpenAI didn't accept your key. Add it again on Home.",
  tooLong:
    "This conversation is too long for Pica to read. Start a new one to keep going.",
  /** One buyer message over the length cap. */
  messageTooLong: "That message is too long. Shorten it and send again.",
  rateLimited:
    "You've sent a lot of messages in a short time. Wait a few minutes, then try again.",
  /** In place of a reply block that stated a price, rating, stock or link. */
  replyWithheld:
    "I left out a detail I can't verify. The price, rating and stock on each product card come from the merchant's listing.",
  /** In place of a reply block whose every sentence read like a sales pitch. */
  replyWithheldPressure:
    "I cut a line that read like a sales pitch. Ask me about any tradeoff and I'll lay it out plainly.",
  modelUnavailable:
    "Pica can't reply right now. Try sending your message again in a moment.",
  badRequest:
    "Pica couldn't read that message. Reload the page and try again.",
  catalogUnavailable:
    "I couldn't reach the Shopify catalog. Try again in a moment.",
  noResults:
    "I didn't find matching products from Shopify merchants. Try fewer must-haves or a wider budget.",
} as const;
