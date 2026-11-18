/**
 * Checks the quote behind a comparison cell.
 *
 * A cell may say "merchant" or "catalog_summary" only when its quote appears
 * in that source: the merchant description, or one line of Shopify's summary.
 *
 * Rules, so a quote can't claim more than the source says:
 * - Words compare one by one, case and punctuation aside. Numbers stay whole,
 *   so "6 kg" does not match "1.6 kg", and a number at either end of the
 *   quote can't be part of a larger figure ("1/2 inch", "13-16 inch").
 * - At least 3 words, or the whole sentence when it is shorter.
 * - Inside one sentence or one summary line. A removed link breaks a sentence.
 * - No negation earlier in the same clause that the quote leaves out ("not
 *   waterproof", "free of PVC"), and no negated heading above it ("Does not
 *   include:" over a list).
 * - A sentence cut to fit loses no "only", "unless", "except", "but" or
 *   negation in the part left off.
 *
 * The cell then carries the whole source sentence that holds the match, so
 * any "not", "no longer" or "Waterproof? No." is in front of the buyer. A
 * sentence that itself reads as a sales claim, a rating, a price (the
 * product's own, even as a bare number), a stock, scarcity or delivery claim
 * is not shown: the cell becomes Pica's read.
 */
import type { CatalogProduct } from "@/pica/lib/types";
import { COMPARE_QUOTE_MAX_CHARS } from "./constants";
import {
  ABBREVIATIONS,
  LIMIT_ABBREVIATIONS,
  NUMBER_ABBREVIATIONS,
  checkReplyText,
  createKnownPrices,
  joinKnownPrices,
  replaceLinks,
  type KnownPrices,
} from "./text-guard";

/** Fewest words a quote needs, unless it is the whole sentence. */
export const QUOTE_MIN_WORDS = 3;

/** Longest text a cell shows. A longer sentence is cut at a word, with "…". */
const EXCERPT_MAX_CHARS = COMPARE_QUOTE_MAX_CHARS;

// Letters and digits. Apostrophes join letters ("isn't"); "." and "," join
// digits only ("1.6", "1,200"), so "1.2kg.Store" splits after "kg".
const WORD = /[\p{L}\p{N}]+(?:(?:['’]|(?<=\p{N})[.,](?=\p{N}))[\p{L}\p{N}]+)*/gu;
// A sentence ends at "!", a line break, or a full stop with white space after
// it. Not at "?": "Waterproof? No." stays whole. Not after a short abbreviation:
// "approx. 2 kg".
const SENTENCE_GAP = /!|\n|\.\s/;
const ABBREVIATION_END = new RegExp(`\\b(?:${ABBREVIATIONS})$`);
const NUMBER_ABBREVIATION_END = new RegExp(`\\b(?:${NUMBER_ABBREVIATIONS})$`);
const LIMIT_ABBREVIATION_END = new RegExp(`\\b(?:${LIMIT_ABBREVIATIONS})$`);
const CLAUSE_GAP = /[,;()]/;
const NEGATIONS = new Set([
  "not",
  "no",
  "non",
  "nor",
  "never",
  "neither",
  "without",
  "cannot",
  "isnt",
  "lack",
  "lacks",
  "lacking",
  "rarely",
  "hardly",
  "except",
  "excludes",
  "excluding",
  "doesnt",
  "dont",
  "wont",
  "cant",
]);
/** Words in a cut-off tail that can change what the kept part means. */
const QUALIFIERS = new Set(["only", "unless", "except", "but"]);
const FIGURE_BEFORE = /\d\s?[/\-–x×]\s?$/;
const FIGURE_AFTER = /^\s?[/\-–x×]\s?\d/;

interface Word {
  text: string;
  start: number;
  end: number;
}

function normalizeWord(word: string): string {
  return word.normalize("NFKC").toLowerCase().replace(/’/g, "'");
}

/** The gap's only sentence break is a full stop closing a short abbreviation: "approx. 2 kg". */
function afterAbbreviation(source: string, gapStart: number, gap: string): boolean {
  if (/[!\n]/.test(gap) || !gap.startsWith(".")) return false;
  const before = source.slice(Math.max(0, gapStart - 8), gapStart);
  if (ABBREVIATION_END.test(before)) return true;
  const next = source[gapStart + gap.length] ?? "";
  // "no. 2" only before a number: "The answer is no. It leaks" ends.
  if (NUMBER_ABBREVIATION_END.test(before)) return /\d/.test(next);
  // "max. load", "max. 17 inch" only before a lower-case letter or a number: "2 kg max. It's light" ends.
  return LIMIT_ABBREVIATION_END.test(before) && /[\p{Ll}\p{N}]/u.test(next);
}

function isNegation(word: string, next?: string): boolean {
  return NEGATIONS.has(word) || word.endsWith("n't") || (word === "free" && next === "of");
}

function wordsOf(text: string): string[] {
  return Array.from(text.matchAll(WORD), (match) => normalizeWord(match[0]));
}

function hasNegation(words: string[]): boolean {
  return words.some((word, k) => isNegation(word, words[k + 1]));
}

/** Most lines walked back to find a heading. */
const HEADING_REACH = 20;

/**
 * A negated heading over the match: "Does not include: a strap" on one line,
 * or "Not suitable for:" on a line above a list. A colon on the match's own
 * line with no negation before it ("Strap: padded", "9:00") is a label, not
 * the heading, so the search goes on up. List lines, with or without a full
 * stop, and blank lines are skipped: a description holds no blank lines of its
 * own, but a link on its own line can leave one. The search stops at the first
 * heading (a line ending in ":") or after HEADING_REACH lines. So prose up to
 * 20 lines under a negated heading is refused too; a refused quote falls back
 * to Pica's read, which is the safe side.
 */
function underNegatedHeading(source: string, at: number): boolean {
  const lines = source.slice(0, at).split("\n");
  const current = lines.pop() ?? "";
  const colon = current.lastIndexOf(":");
  if (colon >= 0 && hasNegation(wordsOf(current.slice(0, colon)))) return true;
  for (let k = lines.length - 1; k >= 0 && k >= lines.length - HEADING_REACH; k--) {
    const line = lines[k].trim();
    if (!line) continue;
    if (line.endsWith(":")) return hasNegation(wordsOf(line));
  }
  return false;
}

/** The source's words, grouped by sentence, with their places in the source. */
function sentencesOf(source: string): Word[][] {
  const sentences: Word[][] = [];
  let current: Word[] = [];
  let lastEnd = 0;
  for (const match of source.matchAll(WORD)) {
    const start = match.index;
    const gap = source.slice(lastEnd, start);
    if (current.length > 0 && SENTENCE_GAP.test(gap) && !afterAbbreviation(source, lastEnd, gap)) {
      sentences.push(current);
      current = [];
    }
    current.push({ text: normalizeWord(match[0]), start, end: start + match[0].length });
    lastEnd = start + match[0].length;
  }
  if (current.length > 0) sentences.push(current);
  return sentences;
}

/** A number at either end of the match runs on into a larger figure. */
function partOfFigure(source: string, first: Word, last: Word): boolean {
  if (/^\p{N}/u.test(first.text) && FIGURE_BEFORE.test(source.slice(Math.max(0, first.start - 4), first.start))) {
    return true;
  }
  return /\p{N}$/u.test(last.text) && FIGURE_AFTER.test(source.slice(last.end, last.end + 4));
}

/** A negation earlier in the clause than word `i`: "not", "lacks", "free of", any "n't". */
function negatedBefore(source: string, sentence: Word[], i: number): boolean {
  for (let k = i - 1; k >= 0; k--) {
    if (CLAUSE_GAP.test(source.slice(sentence[k].end, sentence[k + 1].start))) return false;
    const word = sentence[k].text;
    if (word === "but") return false;
    if (isNegation(word, sentence[k + 1].text)) return true;
  }
  return false;
}

function sentenceEnd(source: string, last: Word): number {
  let end = last.end;
  while (end < source.length && /[.!?…)"”’]/.test(source[end])) end++;
  return end;
}

/**
 * The sentence holding words `from` to `to`, cut to the cap around the match.
 * Null when the part cut off either end could change what the rest means.
 */
function excerpt(source: string, sentence: Word[], from: number, to: number): string | null {
  const lastIndex = sentence.length - 1;
  const end = sentenceEnd(source, sentence[lastIndex]);
  if (end - sentence[0].start <= EXCERPT_MAX_CHARS) return source.slice(sentence[0].start, end);

  const width = (a: number, b: number) => sentence[b].end - sentence[a].start;
  const room = EXCERPT_MAX_CHARS - 2;
  let a = from;
  let b = to;
  for (let grew = true; grew; ) {
    grew = false;
    if (a > 0 && width(a - 1, b) <= room) {
      a--;
      grew = true;
    }
    if (b < lastIndex && width(a, b + 1) <= room) {
      b++;
      grew = true;
    }
  }
  // Words cut off either end must not change what the kept part means.
  for (const cutOff of [sentence.slice(0, a), sentence.slice(b + 1)]) {
    const words = cutOff.map((word) => word.text);
    if (words.some((word) => QUALIFIERS.has(word)) || hasNegation(words)) return null;
  }
  const head = a > 0 ? "…" : "";
  const tail = b < lastIndex ? "…" : source.slice(sentence[b].end, end);
  return head + source.slice(sentence[a].start, sentence[b].end) + tail;
}

/** The source sentence that holds the quote and passes every rule, or null. */
function findIn(source: string, quote: string[], knownPrices: KnownPrices): string | null {
  for (const sentence of sentencesOf(source)) {
    if (quote.length < Math.min(QUOTE_MIN_WORDS, sentence.length)) continue;
    for (let i = 0; i + quote.length <= sentence.length; i++) {
      if (!quote.every((word, j) => sentence[i + j].text === word)) continue;
      const last = i + quote.length - 1;
      if (partOfFigure(source, sentence[i], sentence[last])) continue;
      if (negatedBefore(source, sentence, i)) continue;
      if (underNegatedHeading(source, sentence[i].start)) continue;
      const text = excerpt(source, sentence, i, last);
      if (text === null) continue;
      const { pressure, facts } = checkReplyText(text, { knownPrices });
      if (pressure.length > 0 || facts.length > 0) continue;
      return text;
    }
  }
  return null;
}

/**
 * The source sentence (merchant description) or summary line that holds
 * `quote`, as the buyer should see it, or null when the quote doesn't stand.
 * A bare number equal to the product's price, or to one of `knownPrices`,
 * counts as a price.
 */
export function findQuote(
  product: CatalogProduct,
  basis: "merchant" | "catalog_summary",
  quote: string,
  knownPrices?: KnownPrices,
): string | null {
  const words = wordsOf(quote);
  if (words.length === 0) return null;
  const prices = joinKnownPrices(createKnownPrices([product]), knownPrices);
  // A removed link ends the sentence, so a quote can't join the text on each side.
  if (basis === "merchant") return findIn(replaceLinks(product.descriptionText ?? "", "\n"), words, prices);
  const { sellingPoints = [], features = [], specs = [] } = product.summarized ?? {};
  for (const line of [...sellingPoints, ...features, ...specs]) {
    const found = findIn(replaceLinks(line, "\n"), words, prices);
    if (found) return found;
  }
  return null;
}
