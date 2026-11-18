/**
 * Cheap checks on text the model writes: tool input and Pica's replies. The
 * same rules apply to both.
 *
 * Two families:
 * - Pressure: sales words Pica must never use (superlatives, urgency,
 *   scarcity, match scores).
 * - Catalog facts: prices, ratings, stock, sales, delivery and links. The UI
 *   shows these from catalog records, so the model must not write them. One
 *   exception: an amount the buyer gave, such as their budget, may be echoed.
 *
 * Rules aim at claims, not at words: "the best bag" is blocked, "which is
 * best for you?" passes; "it's sold out" is blocked, "I can't see whether
 * it's sold out" passes; "hurry" is blocked, "no need to hurry" passes. An
 * excuse word counts only in the same clause, a few words before the match.
 *
 * Voice words such as "just", "simply" and "easy" stay out of these rules on
 * purpose: they show up in honest text ("just under the budget"). The prompt
 * asks Pica to avoid them instead. A bare number is blocked only when it is a
 * known product's price, so "fits a 16-inch laptop" is fine.
 *
 * A wording filter can't be complete. These rules catch the common forms.
 * Known limit: a buyer's own deadline ("it must arrive by Friday") is still
 * blocked when Pica repeats it.
 */
import type { CatalogProduct } from "@/pica/lib/types";

export interface Rule {
  label: string;
  test(text: string): boolean;
}

const r = String.raw;

function rule(label: string, pattern: RegExp): Rule {
  return { label, test: (text) => pattern.test(text) };
}

/** Short lower-case abbreviations whose full stop does not end a sentence: "approx. 2 kg", "e.g. a laptop". */
export const ABBREVIATIONS = r`approx|incl|excl|vs|e\.g|i\.e`;
/** An abbreviation only before a number: "no. 2". "The answer is no. Buy it" ends a sentence. */
export const NUMBER_ABBREVIATIONS = r`no`;
/** Abbreviations only before a lower-case letter or a number: "max. 17 inch", "max. load". "2 kg max. It's light" ends a sentence. */
export const LIMIT_ABBREVIATIONS = r`max|min`;

// A sentence ends after "!" or "?" with white space after it; after each line
// break; and after a full stop with white space after it, unless the stop
// closes an abbreviation, a number abbreviation with a number next, or a
// limit abbreviation with a lower-case letter or a number next.
const SENTENCE_BREAK = new RegExp(
  [
    r`(?<=[!?])(?=\s)`,
    r`(?<=(?<!\b(?:${ABBREVIATIONS}|${NUMBER_ABBREVIATIONS}|${LIMIT_ABBREVIATIONS}))\.)(?=\s)`,
    r`(?<=\b(?:${NUMBER_ABBREVIATIONS})\.)(?=\s+[^\s\d])`,
    r`(?<=\b(?:${LIMIT_ABBREVIATIONS})\.)(?=\s+[^\s\p{Ll}\p{N}])`,
    r`(?<=\n)`,
  ].join("|"),
  "u",
);

/** Sentences of `text` with their spacing kept, so joining them gives back the text. */
export function sentenceParts(text: string): string[] {
  return text.split(SENTENCE_BREAK);
}

/** Sentences of `text`, trimmed, with empty ones dropped. */
export function splitSentences(text: string): string[] {
  return sentenceParts(text)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * A rule checked one sentence at a time. A match is let off when
 * `excused(sentence, matchStart)` says so.
 */
function ruleUnless(label: string, pattern: RegExp, excused: (sentence: string, at: number) => boolean): Rule {
  const global = pattern.flags.includes("g") ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  return {
    label,
    test: (text) =>
      splitSentences(text).some((sentence) =>
        Array.from(sentence.matchAll(global)).some((match) => !excused(sentence, match.index)),
      ),
  };
}

const APOS = "['’]";

/** The words of the match's clause before it: back to a comma, semicolon, colon, dash or "but". */
function clauseWordsBefore(sentence: string, at: number): string[] {
  const before = sentence.slice(0, at);
  let start = 0;
  for (const match of before.matchAll(/[,;:—–]|\bbut\b/gi)) start = match.index + match[0].length;
  return before.slice(start).match(/[\p{L}\p{N}'’]+/gu) ?? [];
}

/** An excuse word and up to four words between it and the match. */
const NEAR_WORDS = 5;

function nearBefore(sentence: string, at: number): string {
  return clauseWordsBefore(sentence, at).slice(-NEAR_WORDS).join(" ");
}

/** "If it's sold out", "whether it's in stock". Only these excuse a catalog fact. */
const ASKS_FACT = /\b(?:if|whether|in case)\b/i;
/** "Which works best", "what's best for rain". These excuse a "best" claim, not a fact: "the Aer, which is in stock". */
const ASKS_BEST = /\b(?:if|whether|in case|which|what|whichever)\b/i;
/** "I can't see", "I don't know", "I won't call one best". Anywhere earlier in the clause. */
const CANT_SAY = new RegExp(
  r`\b(?:can${APOS}?t|cannot|can not) (?:see|tell|check|confirm|promise|say|call)\b|\b(?:don${APOS}?t|do not) know\b|\bnot sure\b|\bunsure\b|\b(?:won${APOS}?t|wouldn${APOS}?t|will not|would not) call\b`,
  "i",
);
/** "No need to hurry", "not a perfect fit", "don't have to buy now". */
const NEGATED = new RegExp(
  r`\b(?:not|no|never|don${APOS}?t|do not|doesn${APOS}?t|does not|didn${APOS}?t|needn${APOS}?t|without|nothing)\b`,
  "i",
);

function asked(words: RegExp, sentence: string, at: number): boolean {
  return words.test(nearBefore(sentence, at));
}

function cantSay(sentence: string, at: number): boolean {
  return CANT_SAY.test(clauseWordsBefore(sentence, at).join(" "));
}

/** Negations that add weight to a claim instead of denying it: "no doubt it's the best". */
const STRESSED = new RegExp(
  r`\b(?:no|without|never)\s+(?:doubt|question|wonder)\b|\bnot\s+(?:only|just)\b|\bno\s+other\b|\bnothing\s+(?:beats|tops|else)\b|\bcan${APOS}?t\s+go\s+wrong\b`,
  "gi",
);

function negated(sentence: string, at: number): boolean {
  return NEGATED.test(nearBefore(sentence, at).replace(STRESSED, ""));
}

/** A sales word, let off right after a negation in its clause. */
function pressure(label: string, pattern: RegExp): Rule {
  return ruleUnless(label, pattern, negated);
}

/** A catalog fact, let off when Pica says it can't see it ("I can't tell whether it's in stock"). */
function factUnlessUnsure(label: string, pattern: RegExp): Rule {
  return ruleUnless(label, pattern, (sentence, at) => asked(ASKS_FACT, sentence, at) || cantSay(sentence, at));
}

const PRODUCT_NOUN = r`(?:bags?|backpacks?|packs?|totes?|duffels?|suitcases?|luggage|options?|choices?|ones?|picks?|buys?|deals?|value|fit|products?|models?|bet|items?|sellers?|brands?)`;
const STOCK_NOUN = r`(?:units?|pieces?|pairs?|sizes?|colou?rs?|in\s+stock)`;

/** "It's the best", "the best bag", "best for commuting", "works best". Not "the best I can tell", "do my best", "at best". */
const BEST_CLAIM = new RegExp(
  [
    r`\b(?:is|it${APOS}?s|that${APOS}s|this is|was|are|they${APOS}re|looks|seems)\s+(?:the\s+|your\s+)?(?:very\s+)?best\b(?!\s+(?:i|we|way|to|if|when|depends|of luck)\b)`,
    r`\b(?:the|your|our|its|a)\s+(?:very\s+)?best\s+(?:[\w-]+\s+)?${PRODUCT_NOUN}\b`,
    r`\bthe\s+best\s+of\s+(?:the|these|those|them|all)\b`,
    r`(?<!\b(?:my|our|your|their|at|do|doing)\s+)\bbest\s+(?:in|for|on|overall)\b`,
    r`(?<!\b(?:my|our|your|their)\s+)\bbest\s+${PRODUCT_NOUN}\b`,
    r`\bworks?\s+best\b`,
  ].join("|"),
  "gi",
);

/** "Perfect for you", "the perfect choice", "it's perfect". Not "that's perfectly fine" or a bare "Perfect,". */
const PERFECT_CLAIM = new RegExp(
  r`\bperfect(?:ly)?\s+(?:for|choice|fit|match|pick|option|bag|one|suited)\b|\b(?:is|it${APOS}s|that${APOS}s|a|the|looks|seems)\s+perfect\b`,
  "gi",
);

export const PRESSURE_RULES: readonly Rule[] = [
  // A question alone doesn't excuse "best": "Isn't it the best bag?" is a claim.
  ruleUnless(
    '"best"',
    BEST_CLAIM,
    (sentence, at) => asked(ASKS_BEST, sentence, at) || cantSay(sentence, at) || negated(sentence, at),
  ),
  pressure('"perfect"', PERFECT_CLAIM),
  pressure('"bestseller"', /\bbest[- ]?sell(?:ers?|ing)\b/i),
  pressure('"hurry"', /\bhurry\b/i),
  rule('"don\'t miss"', new RegExp(r`\b(?:don${APOS}?t|do not) miss\b`, "i")),
  pressure('"act now"', /\bact (?:now|fast)\b/i),
  pressure('"buy it today"', /\bbuy\s+(?:(?:it|one|them)\s+)?(?:now|today|tonight)\b/i),
  pressure('"limited time"', /\blimited[- ]time\b/i),
  pressure('"last chance"', /\blast chance\b/i),
  // Scarcity of stock: "only 3 left", "only 2 black ones left". Not "only one question left".
  pressure(
    '"only X left"',
    new RegExp(
      r`\bonly\s+(?:\d+|one|two|three|four|five|a\s+few|few|a\s+couple(?:\s+of)?)\s+(?:(?:[\w-]+\s+){0,2}?(?:${PRODUCT_NOUN}|${STOCK_NOUN})\s+)?left\b`,
      "i",
    ),
  ),
  pressure('"selling fast"', /\b(?:selling|going)\s+(?:out\s+)?fast\b/i),
  pressure('"running low"', /\brunning\s+low\b/i),
  pressure('"no-brainer"', /\bno[- ]brainer\b/i),
  pressure('"must-buy"', /\bmust[- ](?:buy|have it)\b/i),
  pressure('"top-rated"', /\btop[- ]rated\b/i),
  // Not "top pick-up handle".
  pressure('"top pick"', /\btop[- ](?:picks?|choices?)(?![\w-])/i),
  pressure('"most popular"', /\bmost[- ]popular\b/i),
  // "Rucksack No. 1" is a name; "the No. 1 pack" is a claim.
  rule('"#1"', new RegExp(r`#\s?1\b|\bnumber one\b|\b(?:the|our|is|it${APOS}?s|ranked|rated)\s+no\.?\s?1\b`, "i")),
  rule(
    "a match score",
    /\b\d{1,3}\s?%\s?(?:match|fit|score|compatib\w*)|\b(?:match|fit)(?:\s+score)?\s*(?:of|:)?\s*\d{1,3}\s?%/i,
  ),
];

/** Units that count with or without a space: "16 inch", "16-inch", "15 L", "3 days". */
const SPACED_UNIT = r`inch(?:es)?|cm|mm|m|l|liters?|litres?|ml|kg|g|lbs?|pounds?|oz|ounces?|days?|nights?|weeks?|months?|years?|hours?|pockets?|compartments?|zips?|zippers?|wheels?|straps?|colou?rs?|sizes?|people|d|denier|percent`;
/** Units that count only when joined to the number: "16in", "16-in", "2x", "12-piece", "12pcs". */
const JOINED_UNIT = r`in|x|pieces?|pcs`;
/** Things an "in" measure is often of: "a 16 in laptop". */
const IN_NOUN = r`laptops?|screens?|displays?|tablets?|ipads?|macbooks?|notebooks?|monitors?|devices?|computers?|frames?|sleeves?|pockets?|wheels?`;
/** A unit right after a number, so the number is a measure, not a price. */
const UNIT_AFTER = r`(?:\s?-?\s?(?:${SPACED_UNIT})\b|-?(?:${JOINED_UNIT})\b|\s+in\s+(?:${IN_NOUN})\b)`;

const RATING = new RegExp(
  [
    // "4.8/5", but not "5/10" or a date.
    r`(?<![\d.\/])\d(?:\.\d+)?\s?\/\s?5(?![\d\/])`,
    // "4 out of 5", "four out of five", but not "2 out of 5 pockets".
    r`\b(?:\d(?:\.\d+)?|one|two|three|four|five)\s+out\s+of\s+(?:5|five|10|ten)\b(?!\s+(?:${SPACED_UNIT})\b)`,
    // "4.6 of 5": a decimal score needs no rating word.
    r`\b\d\.\d+\s+(?:of|out\s+of)\s+(?:5|five)\b`,
    // "4.6 stars", "five-star", "4.6-star".
    r`\b(?:\d(?:\.\d+)?|one|two|three|four|five|half)[\s-]?stars?\b`,
    r`\d(?:\.\d+)?\s?[★⭐]|[★⭐]{2,}`,
    // "120 reviews", "500+ reviews", "120 customer reviews", "1,200 ratings".
    r`\b\d[\d,]*\+?\s*(?:[a-z]+\s+)?(?:reviews?|ratings?)\b`,
    r`\b\d(?:\.\d+)?[\s-]?rating\b`,
    // "rated 4.6", but not "rated at 30 L".
    r`\brated\s+(?:at\s+)?(?:\d+(?:\.\d+)?(?![\d.])|one|two|three|four|five)(?!${UNIT_AFTER})`,
    // "N of 5" with an integer only after rated, scores or rating.
    r`\b(?:scores?|scored|scoring)\s+(?:a\s+)?\d(?:\.\d+)?\s+(?:of|out of)\s+(?:5|five)\b`,
    r`\brating(?:\s+(?:of|is))?\s*:?\s*\d(?:\.\d+)?\b`,
    r`\bhighly[- ]rated\b`,
  ].join("|"),
  "i",
);

const STOCK = /\b(?:in[- ]stock|out[- ]of[- ]stock|sold[- ]out|low[- ]stock|back[- ]in[- ]stock|ships?\s+(?:today|tomorrow|same[- ]day))\b/gi;
const SALE = /\d{1,3}\s?%\s?off\b|\bon\s+sale\b/gi;

/** A delivery time: "3 days", "3-5 business days", "a week", "Friday", "tomorrow". */
const TIME = r`(?:\d+(?:\s?[-–]\s?\d+)?|a|an|one|two|three|four|five|six|seven|ten|a\s+few|few)\s+(?:business\s+|working\s+)?(?:days?|hours?|hrs?|weeks?|nights?)|tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+(?:day|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|the\s+weekend|christmas`;
const DELIVERY = new RegExp(
  [
    // "Ships in 2 days", "arrives by Friday", "delivery takes a week".
    r`\b(?:ships?|shipped|shipping|arrives?|arrived|arriving|arrival|delivers?|delivered|delivering|delivery|dispatch(?:es|ed)?)\b(?:\s+[\w'’]+){0,3}?\s+(?:in|by|within|takes?|taking|on|before)\s+(?:about\s+|around\s+|under\s+|just\s+|only\s+|less\s+than\s+)?(?:${TIME})\b`,
    r`\b(?:\d+|one|two|three|next|same)[\s-]day\s+(?:shipping|delivery)\b`,
    r`\bfree\s+(?:shipping|delivery|returns?)\b|\bships?\s+(?:for\s+)?free\b`,
  ].join("|"),
  "gi",
);

// Full links and "www." links, any case.
const FULL_LINK = /\b(?:https?:\/\/|www\.)\S+/gi;
// Bare domains such as "shop.com/sale". The domain starts with a letter at a
// word's start and ends in a lower-case ending, so "1.2kg.Store" and
// "laptop.Co-branded" (a missing space after a full stop) are not links.
const BARE_DOMAIN =
  /(?<![\w.-])[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)*\.(?:com|net|org|shop|store|co|io|us|ca|uk)(?![A-Za-z0-9-])(?:\/\S*)?/g;

function hasLink(text: string): boolean {
  return new RegExp(FULL_LINK.source, "i").test(text) || new RegExp(BARE_DOMAIN.source).test(text);
}

/** Prices have their own check below, so amounts the buyer gave can pass. */
export const CATALOG_FACT_RULES: readonly Rule[] = [
  { label: "a link", test: hasLink },
  rule("a rating", RATING),
  factUnlessUnsure("a stock claim", STOCK),
  factUnlessUnsure("a sale claim", SALE),
  factUnlessUnsure("a delivery claim", DELIVERY),
];

/**
 * Text as the rules should read it: full-width and other compatibility forms
 * folded ("＄１２９" reads "$129"), and invisible format characters such as
 * zero-width spaces removed.
 */
export function normalizeForRules(text: string): string {
  return text.normalize("NFKC").replace(/\p{Cf}/gu, "");
}

function scan(text: string, rules: readonly Rule[]): string[] {
  return rules.filter((check) => check.test(text)).map((check) => check.label);
}

/** Labels of every pressure rule the text breaks. Empty means clean. */
export function findPressure(text: string): string[] {
  return scan(normalizeForRules(text), PRESSURE_RULES);
}

// A number with its decimals kept apart: group 1 whole part ("1,200"), group 2 decimals (".50").
const NUM = r`(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?`;
// "2k" is 2000: group 3.
const THOUSANDS = r`(?:\s?(k)\b)?`;
const CURRENCY_CODE = "usd|cad|eur|gbp|aud";

/**
 * Ways a money amount is written. Each pattern's first three groups are the number.
 * "$129", "$2k", "129$", "€ 90", "129 USD", "200-dollar", "USD 129", "costs 129", "priced at 129.99".
 */
const AMOUNT_PATTERNS: readonly RegExp[] = [
  new RegExp(r`[$€£]\s?${NUM}${THOUSANDS}`, "gi"),
  new RegExp(r`\b${NUM}${THOUSANDS}\s?[$€£]`, "gi"),
  new RegExp(r`\b${NUM}${THOUSANDS}[\s-]?(?:${CURRENCY_CODE}|dollars?|bucks|euros?)\b`, "gi"),
  new RegExp(r`\b(?:${CURRENCY_CODE})\s?${NUM}${THOUSANDS}`, "gi"),
  new RegExp(
    r`\b(?:costs?|costing|priced(?:\s+at)?|prices?\s+(?:is|of|at)|sells?\s+for|selling\s+for|retails?\s+(?:for|at)|on sale for)\s+(?:about\s+|around\s+|only\s+|just\s+|roughly\s+)?${NUM}${THOUSANDS}`,
    "gi",
  ),
];

/** One number, with no groups. */
const ONE_NUMBER = r`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;

/**
 * A number standing alone, or a range or slash pair of them ("120-129",
 * "99/129"), not followed by a unit ("16-inch", "15 L", "3 days", "100%",
 * '15″', which NFKC turns into "15′′").
 * Each end of a pair is tested on its own.
 */
const BARE_FIGURE = new RegExp(
  r`(?<![\w.,])${ONE_NUMBER}(?:\s?[-–\/]\s?${ONE_NUMBER})*(?!\d|[.,]\d|\s?[-–\/]\s?\d|\s?%|\s?["”″′]|${UNIT_AFTER})`,
  "gi",
);
const ANY_NUMBER = new RegExp(NUM, "g");

/** A buyer's number that is not a measure: "200", "2k", but not "16 inch" or "3 days". */
const BUYER_NUMBER = new RegExp(r`(?<![\d.,])${NUM}${THOUSANDS}(?!\d|[.,]\d|${UNIT_AFTER})`, "gi");

function toNumber(whole: string, decimals = "", thousands = ""): number {
  const value = Number(whole.replace(/,/g, "") + decimals);
  return thousands ? value * 1000 : value;
}

function numbersFrom(text: string, pattern: RegExp): number[] {
  return Array.from(text.matchAll(pattern), (match) => toNumber(match[1], match[2], match[3]));
}

/** Every money amount in the text, as numbers: "$200.00" and "200 dollars" both give 200, "$2k" gives 2000. */
export function amountsIn(text: string): number[] {
  return AMOUNT_PATTERNS.flatMap((pattern) => numbersFrom(text, pattern));
}

/**
 * Amounts in a buyer's message: every number that is not a measure. "My
 * limit is 200", "200 max", "150-200", "$150-200" and "2k" all count; "a
 * 16-inch laptop" and "3 days" do not. The buyer wrote them, so Pica may
 * repeat them. Worded amounts ("two hundred") are not read.
 */
export function buyerAmountsIn(text: string): number[] {
  return numbersFrom(text, BUYER_NUMBER);
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** A fixed set of amounts, compared in cents. */
export interface AmountAllowList {
  has(amount: number): boolean;
}

export function createAmountAllowList(amounts: Iterable<number> = []): AmountAllowList {
  const cents = new Set<number>();
  for (const amount of amounts) if (Number.isFinite(amount)) cents.add(toCents(amount));
  return { has: (amount) => cents.has(toCents(amount)) };
}

/**
 * Prices of the products Pica knows of. A bare number equal to one, whole,
 * with cents or rounded, reads as a price. Grows as search finds products.
 */
export interface KnownPrices {
  has(amount: number): boolean;
  addProducts(products: readonly Pick<CatalogProduct, "priceRange">[]): void;
}

export function createKnownPrices(products: readonly Pick<CatalogProduct, "priceRange">[] = []): KnownPrices {
  const cents = new Set<number>();
  const known: KnownPrices = {
    has: (amount) => cents.has(toCents(amount)),
    addProducts(list) {
      for (const product of list) {
        for (const money of [product.priceRange?.min, product.priceRange?.max]) {
          if (!money || !Number.isFinite(money.amount)) continue;
          cents.add(Math.round(money.amount));
          // "$129.99" may be written as a bare "129" or "130".
          cents.add(Math.floor(money.amount / 100) * 100);
          cents.add(Math.round(money.amount / 100) * 100);
        }
      }
    },
  };
  known.addProducts(products);
  return known;
}

/** Both lists at once: a number either knows is known. */
export function joinKnownPrices(...lists: (KnownPrices | undefined)[]): KnownPrices {
  const present = lists.filter((list): list is KnownPrices => list !== undefined);
  return {
    has: (amount) => present.some((list) => list.has(amount)),
    addProducts: (products) => present[0]?.addProducts(products),
  };
}

export interface TextGuardOptions {
  /** Amounts the buyer gave (budget, their messages). Text may repeat these. */
  allowedAmounts?: readonly number[] | AmountAllowList;
  /** Prices of known products. A bare number equal to one counts as a price. */
  knownPrices?: KnownPrices;
}

export function toAmountAllowList(allowed: TextGuardOptions["allowedAmounts"]): AmountAllowList {
  if (allowed && "has" in allowed) return allowed;
  return createAmountAllowList(allowed ?? []);
}

const NO_PRICES = createKnownPrices();

function priceFound(text: string, allowed: AmountAllowList, known: KnownPrices): boolean {
  if (amountsIn(text).some((amount) => !allowed.has(amount))) return true;
  for (const figure of text.matchAll(BARE_FIGURE)) {
    if (numbersFrom(figure[0], ANY_NUMBER).some((n) => known.has(n) && !allowed.has(n))) return true;
  }
  return false;
}

function catalogFacts(text: string, allowed: AmountAllowList, known: KnownPrices): string[] {
  return [...(priceFound(text, allowed, known) ? ["a price"] : []), ...scan(text, CATALOG_FACT_RULES)];
}

/** The check for tool input, with the buyer's amounts and the known prices fixed. */
export function bannedTextCheck(options: TextGuardOptions = {}): (text: string) => string[] {
  const allowed = toAmountAllowList(options.allowedAmounts);
  const known = options.knownPrices ?? NO_PRICES;
  return (raw) => {
    const text = normalizeForRules(raw);
    return [...scan(text, PRESSURE_RULES), ...catalogFacts(text, allowed, known)];
  };
}

/**
 * Labels of every pressure or catalog-fact rule the text breaks. Any money
 * amount counts as a price unless it is in `allowedAmounts`.
 */
export function findBannedText(text: string, options: TextGuardOptions = {}): string[] {
  return bannedTextCheck(options)(text);
}

/** The same rules as `findBannedText`, with pressure and catalog facts kept apart. */
export function checkReplyText(
  raw: string,
  options: TextGuardOptions = {},
): { pressure: string[]; facts: string[] } {
  const text = normalizeForRules(raw);
  return {
    pressure: scan(text, PRESSURE_RULES),
    facts: catalogFacts(text, toAmountAllowList(options.allowedAmounts), options.knownPrices ?? NO_PRICES),
  };
}

/**
 * Check several labelled strings at once. Returns one line per problem,
 * written for the model so it can fix its next call.
 */
export function describeBannedText(
  fields: { where: string; text: string }[],
  check: (text: string) => string[] = findBannedText,
): string[] {
  const problems: string[] = [];
  for (const { where, text } of fields) {
    const found = check(text);
    if (found.length > 0) problems.push(`${where} contains ${found.join(", ")}.`);
  }
  return problems;
}

/** Put `by` where each link was. */
export function replaceLinks(text: string, by: string): string {
  return text.replace(FULL_LINK, by).replace(BARE_DOMAIN, by);
}

/** Remove links and squeeze spaces. Used on text the model or merchant wrote. */
export function stripLinks(text: string): string {
  return replaceLinks(text, "").replace(/\s{2,}/g, " ").trim();
}
