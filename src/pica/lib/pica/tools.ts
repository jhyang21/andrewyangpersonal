/**
 * Pica's five tools, built fresh for each request.
 *
 * The factory closes over a working copy of the canvas and of the known
 * products (the session's products plus whatever search finds in this
 * request). Guardrail failures throw a message written for the model; the
 * client sees those as `output-error` parts and should hide them.
 */
import { tool } from "ai";
import { z } from "zod";
import { searchCatalog, ShopifyError } from "@/pica/lib/shopify";
import {
  CATEGORIES,
  PICA_TOOLS,
  type AskQuestionOutput,
  type Canvas,
  type CatalogProduct,
  type CatalogSearchParams,
  type Category,
  type ChatSessionContext,
  type ComparisonCell,
  type CompareProductsOutput,
  type PresentShortlistOutput,
  type SearchCatalogOutput,
  type ShortlistEntry,
  type UpdateCanvasOutput,
} from "@/pica/lib/types";
import { applyCanvasPatch, canvasPatchSchema, newCanvasItemId } from "./canvas";
import {
  COMPARE_MAX,
  COMPARE_MIN,
  COMPARE_QUOTE_MAX_CHARS,
  MAX_QUESTIONS,
  PICA_MESSAGES,
  SHORTLIST_MAX,
  SHORTLIST_MIN,
} from "./constants";
import { screenCandidates, type DecisionOptions } from "./decisions";
import { digestProduct } from "./digest";
import { findQuote } from "./evidence";
import { checkProductIds, knownProductsFrom } from "./product-guard";
import {
  bannedTextCheck,
  createKnownPrices,
  describeBannedText,
  stripLinks,
  toAmountAllowList,
  type AmountAllowList,
  type KnownPrices,
} from "./text-guard";

const T = PICA_TOOLS;
const categorySchema = z.enum(CATEGORIES as [Category, ...Category[]]);
const SEARCH_LIMIT = 10;

export interface PicaToolsContext {
  session: ChatSessionContext;
  /** Questions asked since the last shortlist, counted from the history. */
  questionsAsked: number;
  /**
   * Amounts the buyer gave: numbers in their messages and a stated canvas
   * budget sent with the request. Tool text may repeat these. Fixed for the
   * request: nothing the model does adds to it.
   */
  allowedAmounts?: readonly number[] | AmountAllowList;
  /**
   * Prices of known products. Search adds what it finds. Pass the same list
   * to the reply guard so a reply can't state a price as a bare number.
   */
  knownPrices?: KnownPrices;
  decisions?: DecisionOptions;
  now?: () => number;
  makeId?: () => string;
}

/** A note to the model about its own call. Safe to show: it holds no server detail. */
class ToolRejection extends Error {}

/** What the model and the client see when a tool fails for a reason that isn't one of our checks. */
export const TOOL_FAILED_TEXT = "This tool failed on the app's side. Carry on without it, or try once more.";

/** Thrown back to the model so it can fix its call. */
function rejectCall(toolName: string, problems: string[]): never {
  throw new ToolRejection(
    `Nothing was shown to the buyer. Fix these and call ${toolName} again:\n- ${problems.join("\n- ")}`,
  );
}

/**
 * Run a tool's work. Our own rejections pass through to the model as written;
 * any other error is logged here and replaced with a generic line, so no
 * server detail reaches the model or the client.
 */
async function runSafely<T>(toolName: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ToolRejection) throw error;
    console.error(`[pica] ${toolName} failed:`, error instanceof Error ? error.message : error);
    throw new Error(TOOL_FAILED_TEXT);
  }
}

// A note that admits a short list: "only two", "two good fits", "fewer", "couldn't find more".
const FEWER_FITS =
  /\b(fewer|only (?:found )?(?:one|two|1|2)|just (?:one|two|1|2)|(?:one|two|1|2) (?:good |close |real )?(?:fits?|matches|options|picks|products|bags)|(?:couldn't|could not|didn't|did not) find|no other|no more)\b/i;

/**
 * Price filters for a search. Fields the model left out come from the canvas
 * budget. A reversed range is swapped. The model may still pass a wider range
 * on purpose, for a stretch option.
 */
function priceFilters(
  input: { minPriceUsd?: number; maxPriceUsd?: number },
  budget: Canvas["budget"],
): Pick<CatalogSearchParams, "minPriceUsd" | "maxPriceUsd"> {
  let min = input.minPriceUsd ?? budget?.minUsd;
  let max = input.maxPriceUsd ?? budget?.maxUsd;
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  const filters: Pick<CatalogSearchParams, "minPriceUsd" | "maxPriceUsd"> = {};
  if (min !== undefined) filters.minPriceUsd = Math.max(0, Math.floor(min));
  if (max !== undefined) filters.maxPriceUsd = Math.ceil(max);
  return filters;
}

export function createPicaTools(context: PicaToolsContext) {
  const now = context.now ?? Date.now;
  const makeId = context.makeId ?? newCanvasItemId;
  const known = knownProductsFrom(context.session.products ?? []);
  let canvas = context.session.canvas;
  const knownPrices = context.knownPrices ?? createKnownPrices(context.session.products ?? []);
  const allowed = toAmountAllowList(context.allowedAmounts);
  const checkText = bannedTextCheck({ allowedAmounts: allowed, knownPrices });
  // Questions since the last shortlist. A shortlist in this request resets it.
  let questionsSinceShortlist = context.questionsAsked;
  let askedThisRequest = 0;

  const tools = {
    [T.updateCanvas]: tool({
      description:
        "Record what you learned about the buyer's needs on the decision canvas. Send only what changes. Mark an item \"stated\" only when the buyer said it; otherwise \"inferred\". Returns the full canvas with item IDs.",
      inputSchema: canvasPatchSchema,
      execute: (patch): Promise<UpdateCanvasOutput> =>
        runSafely(T.updateCanvas, async () => {
          const problems = describeBannedText(
            [
              ...(patch.outcome ? [{ where: "outcome", text: patch.outcome.text }] : []),
              ...(patch.add ?? []).map((item, i) => ({ where: `add ${i + 1}`, text: item.text })),
              ...(patch.change ?? []).flatMap((item, i) =>
                item.text === undefined ? [] : [{ where: `change ${i + 1}`, text: item.text }],
              ),
            ],
            checkText,
          );
          if (problems.length > 0) rejectCall(T.updateCanvas, problems);
          canvas = applyCanvasPatch(canvas, patch, makeId);
          // The client sends a "stated" budget back and the next request lets
          // replies echo it. So only an amount the buyer gave may be stored as
          // stated; any other is stored as inferred, whatever the model said.
          const budget = canvas.budget;
          if (patch.budget && budget?.source === "stated") {
            const amounts = [budget.minUsd, budget.maxUsd].filter((amount) => amount !== undefined);
            if (amounts.some((amount) => !allowed.has(amount))) {
              canvas = { ...canvas, budget: { ...budget, source: "inferred" } };
            }
          }
          return { canvas };
        }),
    }),

    [T.askQuestion]: tool({
      description: `Ask the buyer one question whose answer changes which product suits them. The turn ends after this call, so don't repeat the question in text. At most ${MAX_QUESTIONS} questions before each shortlist.`,
      inputSchema: z.object({
        question: z.string().min(3).max(160),
        why: z
          .string()
          .min(3)
          .max(200)
          .describe("One sentence on how the answer changes the pick."),
        options: z
          .array(z.string().min(1).max(60))
          .min(2)
          .max(4)
          .describe('2 to 4 quick answers. No money amounts the buyer didn\'t give; for budget ranges write bare numbers, such as "Under 100" or "100 to 200".'),
      }),
      execute: (input): Promise<AskQuestionOutput> =>
        runSafely(T.askQuestion, async () => {
          if (questionsSinceShortlist >= MAX_QUESTIONS) {
            rejectCall(T.askQuestion, [
              `You've used all ${MAX_QUESTIONS} questions before this shortlist. Call ${T.searchCatalog} with what you know instead.`,
            ]);
          }
          if (askedThisRequest >= 1) {
            rejectCall(T.askQuestion, ["Ask one question per turn."]);
          }
          const problems = describeBannedText(
            [
              { where: "question", text: input.question },
              { where: "why", text: input.why },
              ...input.options.map((text, i) => ({ where: `option ${i + 1}`, text })),
            ],
            checkText,
          );
          if (problems.length > 0) rejectCall(T.askQuestion, problems);
          askedThisRequest++;
          questionsSinceShortlist++;
          return {
            question: {
              question: stripLinks(input.question),
              why: stripLinks(input.why),
              options: input.options.map(stripLinks).filter(Boolean),
            },
          };
        }),
    }),

    [T.searchCatalog]: tool({
      description:
        "Search Shopify merchants' products. This is the only source of products. Write the query in plain words with the features that matter. No prices in the query; use the price fields.",
      inputSchema: z.object({
        query: z.string().min(2).max(200),
        category: categorySchema.optional().describe("Defaults to the canvas category."),
        minPriceUsd: z.number().nonnegative().optional().describe("Whole US dollars. Defaults to the canvas budget."),
        maxPriceUsd: z.number().positive().optional().describe("Whole US dollars. Defaults to the canvas budget."),
      }),
      execute: (input): Promise<SearchCatalogOutput> =>
        runSafely(T.searchCatalog, async () => {
          const params: CatalogSearchParams = {
            query: input.query,
            limit: SEARCH_LIMIT,
            ...priceFilters(input, canvas.budget),
          };
          const category = input.category ?? canvas.category ?? undefined;
          if (category) params.category = category;

          let found: CatalogProduct[];
          let totalCount: number | null;
          try {
            const result = await searchCatalog(params);
            found = result.products;
            totalCount = result.totalCount;
          } catch (error) {
            const problem =
              error instanceof ShopifyError
                ? error.error
                : { code: "catalog_unavailable" as const, message: PICA_MESSAGES.catalogUnavailable };
            return { products: [], totalCount: null, problem };
          }

          if (found.length === 0) {
            return {
              products: [],
              totalCount,
              problem: { code: "not_found", message: PICA_MESSAGES.noResults },
            };
          }

          const products = await screenCandidates(found, canvas, context.decisions);
          for (const product of products) known.set(product.id, product);
          knownPrices.addProducts(products);
          return { products, totalCount };
        }),
      toModelOutput: ({ output }) => {
        try {
          const value: Record<string, unknown> = {
            products: output.products.map(digestProduct),
            totalCount: output.totalCount,
          };
          if (output.problem) {
            value.problem = { code: output.problem.code, message: output.problem.message };
          }
          return { type: "json", value: JSON.parse(JSON.stringify(value)) };
        } catch {
          return { type: "text", value: "The search results could not be read." };
        }
      },
    }),

    [T.presentShortlist]: tool({
      description: `Show the buyer ${SHORTLIST_MIN} to ${SHORTLIST_MAX} differentiated products from the catalog, each with why it fits, why they might not want it, a value note and what the listing doesn't confirm. Use only product IDs from search results or the session.`,
      inputSchema: z.object({
        entries: z
          .array(
            z.object({
              productId: z.string(),
              angle: z.string().min(2).max(60).describe('What sets it apart, e.g. "The lighter option".'),
              whyItFits: z.array(z.string().min(2).max(200)).min(1).max(4),
              whyNot: z.array(z.string().min(2).max(200)).min(1).max(3),
              valueNote: z.string().min(2).max(240).describe("What the price buys or fails to buy against the others. No amounts, except ones the buyer gave."),
              unverified: z.array(z.string().min(2).max(160)).max(4),
            }),
          )
          .min(1)
          .max(SHORTLIST_MAX),
        note: z
          .string()
          .min(2)
          .max(400)
          .describe("Short framing of the set. Say when waiting or a cheaper choice makes sense, and when the catalog gave fewer fits."),
      }),
      execute: (input): Promise<PresentShortlistOutput> =>
        runSafely(T.presentShortlist, async () => {
          const problems = checkProductIds(
            input.entries.map((entry) => entry.productId),
            known,
            { rejectNearIdentical: true },
          );
          if (input.entries.length < SHORTLIST_MIN && !FEWER_FITS.test(input.note)) {
            problems.push(
              `There are fewer than ${SHORTLIST_MIN} entries. Say in the note that the catalog gave fewer good fits, such as "I found two good fits."`,
            );
          }
          problems.push(
            ...describeBannedText([
              { where: "note", text: input.note },
              ...input.entries.flatMap((entry, i) => {
                const at = `entry ${i + 1}`;
                return [
                  { where: `${at} angle`, text: entry.angle },
                  { where: `${at} valueNote`, text: entry.valueNote },
                  ...entry.whyItFits.map((text) => ({ where: `${at} whyItFits`, text })),
                  ...entry.whyNot.map((text) => ({ where: `${at} whyNot`, text })),
                  ...entry.unverified.map((text) => ({ where: `${at} unverified`, text })),
                ];
              }),
            ], checkText),
          );
          if (problems.length > 0) rejectCall(T.presentShortlist, problems);

          const entries: ShortlistEntry[] = input.entries.map((entry) => ({
            productId: entry.productId,
            angle: entry.angle.trim(),
            whyItFits: entry.whyItFits.map((s) => s.trim()),
            whyNot: entry.whyNot.map((s) => s.trim()),
            valueNote: entry.valueNote.trim(),
            unverified: entry.unverified.map((s) => s.trim()),
          }));
          questionsSinceShortlist = 0;
          return {
            shortlist: { entries, note: input.note.trim(), createdAt: now(), stale: false },
          };
        }),
    }),

    [T.compareProducts]: tool({
      description:
        "Compare products side by side on the buyer's priorities. One row per priority, one cell per product. Each cell says where its claim comes from: merchant, catalog_summary, inference or missing. For merchant or catalog_summary, copy a short quote (at most about 20 words) word for word from that product's merchantDescription or shopifySummary. A cell whose quote isn't found there shows as your read.",
      inputSchema: z.object({
        productIds: z.array(z.string()).min(COMPARE_MIN).max(COMPARE_MAX),
        rows: z
          .array(
            z.object({
              priority: z.string().min(2).max(80).describe('A buyer priority, e.g. "Fits a 16-inch laptop".'),
              cells: z.array(
                z.object({
                  productId: z.string(),
                  note: z.string().min(1).max(200),
                  basis: z.enum(["merchant", "catalog_summary", "inference", "missing"]),
                  quote: z
                    .string()
                    .min(1)
                    .max(COMPARE_QUOTE_MAX_CHARS)
                    .optional()
                    .describe(
                      "Needed for merchant and catalog_summary, or the cell shows as your read: words copied exactly from merchantDescription (merchant) or one shopifySummary line (catalog_summary). At most about 20 words.",
                    ),
                }),
              ),
            }),
          )
          .min(1)
          .max(8),
        takeaway: z.string().min(2).max(300).describe("The main tradeoff in a sentence or two. Not a verdict."),
      }),
      execute: (input): Promise<CompareProductsOutput> =>
        runSafely(T.compareProducts, async () => {
          const problems = checkProductIds(input.productIds, known, { rejectNearIdentical: false });
          const ids = new Set(input.productIds);
          input.rows.forEach((row, i) => {
            for (const cell of row.cells) {
              if (!ids.has(cell.productId)) {
                problems.push(`row ${i + 1} has a cell for ${cell.productId}, which is not in productIds.`);
              }
            }
          });
          problems.push(
            ...describeBannedText([
              { where: "takeaway", text: input.takeaway },
              ...input.rows.flatMap((row, i) => [
                { where: `row ${i + 1} priority`, text: row.priority },
                ...row.cells.map((cell) => ({ where: `row ${i + 1} cell for ${cell.productId}`, text: cell.note })),
              ]),
            ], checkText),
          );
          if (problems.length > 0) rejectCall(T.compareProducts, problems);

          const rows = input.rows.map((row) => ({
            priority: row.priority.trim(),
            cells: input.productIds.map((productId): ComparisonCell => {
              const cell = row.cells.find((c) => c.productId === productId);
              if (!cell) return { productId, note: "Not covered.", basis: "missing" };
              const note = cell.note.trim();
              if (cell.basis !== "merchant" && cell.basis !== "catalog_summary") {
                return { productId, note, basis: cell.basis };
              }
              // The label holds only when the quote is in the text the model read.
              // No quote, or one not found, makes the claim Pica's read. The cell
              // carries the listing's own words, not the model's copy.
              const product = known.get(productId);
              const quote = product ? findQuote(product, cell.basis, cell.quote ?? "", knownPrices) : null;
              if (!quote) return { productId, note, basis: "inference" };
              return { productId, note, basis: cell.basis, quote };
            }),
          }));

          return {
            comparison: {
              productIds: input.productIds,
              rows,
              takeaway: input.takeaway.trim(),
              createdAt: now(),
              stale: false,
            },
          };
        }),
    }),
  };

  return {
    tools,
    /** The canvas after this request's updates. */
    getCanvas: () => canvas,
    known,
  };
}

export type PicaToolSet = ReturnType<typeof createPicaTools>["tools"];
