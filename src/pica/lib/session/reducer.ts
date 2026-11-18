/**
 * The decision session reducer. Pure: no clock, no storage, no window.
 * Every action carries its own time (`at`) so tests stay exact.
 */
import {
  EMPTY_CANVAS,
  type AskQuestionOutput,
  type Canvas,
  type CanvasItem,
  type CatalogProduct,
  type Category,
  type CompareProductsOutput,
  type ConfidenceCheck,
  type Decision,
  type DecisionSession,
  type OutcomeFeedback,
  type PresentShortlistOutput,
  type SearchCatalogOutput,
  type UpdateCanvasOutput,
} from "@/pica/lib/types";
import { compactMessages, searchProducts } from "./messages";

/** One completed tool call from Pica, keyed by its tool call ID. */
export type ToolOutput =
  | { tool: "update_canvas"; output: UpdateCanvasOutput }
  | { tool: "ask_question"; output: AskQuestionOutput }
  | { tool: "search_catalog"; output: SearchCatalogOutput }
  | { tool: "present_shortlist"; output: PresentShortlistOutput }
  | { tool: "compare_products"; output: CompareProductsOutput };

/** A change the buyer makes on the canvas. Buyer edits are always "stated". */
export type CanvasEdit =
  | { kind: "category"; category: Category | null }
  | { kind: "outcome"; text: string }
  | { kind: "outcome_confirmed" }
  | { kind: "budget"; minUsd?: number; maxUsd?: number }
  | { kind: "budget_confirmed" }
  | { kind: "item_added"; item: Omit<CanvasItem, "source"> }
  | { kind: "item_changed"; id: string; text: string }
  | { kind: "item_removed"; id: string }
  | { kind: "item_confirmed"; id: string };

/** The chat request a tool output answers: when it went out, and the canvas it carried. */
export interface SentRequest {
  at: number;
  canvas: Canvas;
}

/**
 * Fields this layer keeps beside the shared `DecisionSession` type. Both are
 * optional, so sessions saved before them still load.
 * TODO(types.ts owner): move these into `DecisionSession`.
 */
export interface SessionExtras {
  /** When the buyer last changed the canvas. Pica's updates do not count. */
  canvasEditedAt?: number;
  /** What the buyer went to check out. The decision itself waits for their answer. */
  checkoutTarget?: { productId: string; variantId: string; options?: { name: string; label: string }[] };
  /** The chat request (its `SentRequest.at`) that built the shortlist. */
  shortlistRequestAt?: number;
  /** The chat request that built the comparison. */
  comparisonRequestAt?: number;
}

export type Session = DecisionSession & SessionExtras;

export type SessionAction =
  | { type: "messages_set"; messages: unknown[]; at: number }
  | ({ type: "tool_output_applied"; toolCallId: string; at: number; request?: SentRequest } & ToolOutput)
  | { type: "products_merged"; products: CatalogProduct[]; at: number }
  | { type: "canvas_edited"; edit: CanvasEdit; at: number }
  | {
      type: "checkout_started";
      productId: string;
      variantId: string;
      /** The options of that variant, so the decide page can show it again on return. */
      options?: { name: string; label: string }[];
      at: number;
    }
  | { type: "checkout_answered"; bought: boolean; at: number }
  | {
      type: "decided";
      status: "saved" | "declined";
      productId?: string;
      variantId?: string;
      at: number;
    }
  | { type: "reason_set"; reason: string | undefined; at: number }
  | { type: "reopened"; at: number }
  | { type: "confidence_submitted"; check: ConfidenceCheck; at: number }
  | { type: "outcome_submitted"; outcome: OutcomeFeedback; at: number };

const TITLE_MAX = 60;

/** A short title for the saved list, cut on a word boundary. */
export function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= TITLE_MAX) return clean;
  const cut = clean.slice(0, TITLE_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, "");
}

export interface NewSessionInput {
  id: string;
  at: number;
  title: string;
  messages?: unknown[];
  canvas?: Canvas;
  products?: CatalogProduct[];
  /** A scripted demo decision. */
  demo?: true;
}

export function createSession(input: NewSessionInput): DecisionSession {
  const products: Record<string, CatalogProduct> = {};
  for (const product of input.products ?? []) products[product.id] = product;
  return {
    id: input.id,
    createdAt: input.at,
    updatedAt: input.at,
    title: titleFrom(input.title) || "New decision",
    canvas: input.canvas ?? EMPTY_CANVAS,
    messages: input.messages ?? [],
    appliedToolCallIds: [],
    products,
    shortlist: null,
    comparison: null,
    decision: { status: "open" },
    ...(input.demo ? { demo: true as const } : {}),
  };
}

function mergeProducts(
  current: Record<string, CatalogProduct>,
  products: CatalogProduct[],
): Record<string, CatalogProduct> {
  if (products.length === 0) return current;
  const next = { ...current };
  for (const product of products) next[product.id] = product;
  return next;
}

/**
 * Add records the session lacks, keeping the ones it has: those may be
 * fresher, from the decide screen's refetch.
 */
function addMissing(
  current: Record<string, CatalogProduct>,
  products: CatalogProduct[],
): Record<string, CatalogProduct> {
  const missing = products.filter((product) => !(product.id in current));
  return missing.length === 0 ? current : mergeProducts(current, missing);
}

/**
 * Mark the shortlist and comparison stale after the canvas changes, by the
 * buyer or by Pica. A shortlist built after the change clears the mark.
 * `request` is set for Pica's changes: a shortlist or comparison built in that
 * same reply stays as it is, whichever tool came first, because Pica built it
 * for the canvas it was setting.
 */
function markStale(session: Session, request?: SentRequest): Pick<DecisionSession, "shortlist" | "comparison"> {
  const sameReply = (builtBy: number | undefined) => request !== undefined && builtBy === request.at;
  return {
    shortlist: session.shortlist
      ? sameReply(session.shortlistRequestAt)
        ? session.shortlist
        : { ...session.shortlist, stale: true }
      : null,
    comparison: session.comparison
      ? sameReply(session.comparisonRequestAt)
        ? session.comparison
        : { ...session.comparison, stale: true }
      : null,
  };
}

/** Turning one of Pica's guesses into the buyer's own words, with the text unchanged. */
function isConfirm(edit: CanvasEdit): boolean {
  return edit.kind === "item_confirmed" || edit.kind === "outcome_confirmed" || edit.kind === "budget_confirmed";
}

function editCanvas(canvas: Canvas, edit: CanvasEdit): Canvas {
  switch (edit.kind) {
    case "category":
      return canvas.category === edit.category ? canvas : { ...canvas, category: edit.category };
    case "outcome": {
      const text = edit.text.trim();
      if (!text) return canvas.outcome ? { ...canvas, outcome: null } : canvas;
      if (canvas.outcome?.text === text && canvas.outcome.source === "stated") return canvas;
      return { ...canvas, outcome: { text, source: "stated" } };
    }
    case "outcome_confirmed":
      if (!canvas.outcome || canvas.outcome.source === "stated") return canvas;
      return { ...canvas, outcome: { ...canvas.outcome, source: "stated" } };
    case "budget": {
      let min = edit.minUsd;
      let max = edit.maxUsd;
      if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
      if (min === undefined && max === undefined) {
        return canvas.budget ? { ...canvas, budget: null } : canvas;
      }
      // Keys in the schema's order (min, max, source), as the server sends them.
      const budget: NonNullable<Canvas["budget"]> = {
        ...(min !== undefined ? { minUsd: Math.round(min) } : {}),
        ...(max !== undefined ? { maxUsd: Math.round(max) } : {}),
        source: "stated",
      };
      const old = canvas.budget;
      if (old && old.minUsd === budget.minUsd && old.maxUsd === budget.maxUsd && old.source === "stated") {
        return canvas;
      }
      return { ...canvas, budget };
    }
    case "budget_confirmed":
      if (!canvas.budget || canvas.budget.source === "stated") return canvas;
      return { ...canvas, budget: { ...canvas.budget, source: "stated" } };
    case "item_added": {
      const text = edit.item.text.trim();
      if (!text) return canvas;
      if (canvas.items.some((item) => item.id === edit.item.id)) return canvas;
      return { ...canvas, items: [...canvas.items, { ...edit.item, text, source: "stated" }] };
    }
    case "item_changed": {
      const text = edit.text.trim();
      const item = canvas.items.find((candidate) => candidate.id === edit.id);
      if (!item || !text || (item.text === text && item.source === "stated")) return canvas;
      return {
        ...canvas,
        items: canvas.items.map((candidate) =>
          candidate.id === edit.id ? { ...candidate, text, source: "stated" } : candidate,
        ),
      };
    }
    case "item_removed":
      if (!canvas.items.some((item) => item.id === edit.id)) return canvas;
      return { ...canvas, items: canvas.items.filter((item) => item.id !== edit.id) };
    case "item_confirmed": {
      const item = canvas.items.find((candidate) => candidate.id === edit.id);
      if (!item || item.source === "stated") return canvas;
      return {
        ...canvas,
        items: canvas.items.map((candidate) =>
          candidate.id === edit.id ? { ...candidate, source: "stated" } : candidate,
        ),
      };
    }
  }
}

/**
 * Deep equality for plain JSON data. Key order does not matter, and a key set
 * to undefined counts as missing, as it would in JSON.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, i) => sameValue(value, b[i]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = (record: Record<string, unknown>) => Object.keys(record).filter((key) => record[key] !== undefined);
  const leftKeys = keys(left);
  if (leftKeys.length !== keys(right).length) return false;
  return leftKeys.every((key) => sameValue(left[key], right[key]));
}

/**
 * Pica's canvas, with the buyer's changes made since `base` (the canvas sent
 * with the request) laid on top. The buyer wins where both changed a field.
 */
export function mergeCanvas(base: Canvas, current: Canvas, incoming: Canvas): Canvas {
  const pick = <K extends "category" | "outcome" | "budget">(key: K): Canvas[K] =>
    sameValue(base[key], current[key]) ? incoming[key] : current[key];

  const baseItems = new Map(base.items.map((item) => [item.id, item]));
  const currentIds = new Set(current.items.map((item) => item.id));
  const removed = new Set(base.items.filter((item) => !currentIds.has(item.id)).map((item) => item.id));
  const changed = new Map(
    current.items
      .filter((item) => baseItems.has(item.id) && !sameValue(baseItems.get(item.id), item))
      .map((item) => [item.id, item]),
  );

  const items: CanvasItem[] = incoming.items
    .filter((item) => !removed.has(item.id))
    .map((item) => changed.get(item.id) ?? item);
  const have = new Set(items.map((item) => item.id));
  for (const item of current.items) {
    if (have.has(item.id)) continue;
    // Added by the buyer after the request, or changed by them and dropped by Pica.
    if (!baseItems.has(item.id) || changed.has(item.id)) items.push(item);
  }
  return { category: pick("category"), outcome: pick("outcome"), budget: pick("budget"), items };
}

/** The canvas with who-said-it left out, to tell a confirm from a real change. */
function withoutSource(canvas: Canvas): unknown {
  const { outcome, budget, items, ...rest } = canvas;
  const strip = <T extends { source: unknown }>(value: T) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { source, ...kept } = value;
    return kept;
  };
  return {
    ...rest,
    outcome: outcome ? strip(outcome) : null,
    budget: budget ? strip(budget) : null,
    items: items.map(strip),
  };
}

/** True when the buyer changed the canvas after this request went out. */
function editedSince(session: Session, request: SentRequest | undefined): boolean {
  if (!request || session.canvasEditedAt === undefined) return false;
  return session.canvasEditedAt > request.at;
}

function applyToolOutput(session: Session, output: ToolOutput, request: SentRequest | undefined): Partial<Session> {
  switch (output.tool) {
    case "update_canvas": {
      const incoming = output.output.canvas;
      const canvas =
        request && editedSince(session, request) ? mergeCanvas(request.canvas, session.canvas, incoming) : incoming;
      // "Make it under $100" from chat: the old shortlist no longer matches. A
      // shortlist from this same reply, before or after this update, stays current.
      if (sameValue(canvas, session.canvas)) return {};
      // "Yes, 16-inch" from chat only turns a guess into a stated need: the
      // shortlist and comparison still match, as with a confirm on the canvas.
      if (sameValue(withoutSource(canvas), withoutSource(session.canvas))) return { canvas };
      return { canvas, ...markStale(session, request) };
    }
    case "ask_question":
      // The question lives in the message history. Nothing to store.
      return {};
    case "search_catalog":
      return { products: mergeProducts(session.products, output.output.products ?? []) };
    case "present_shortlist":
      // Built from the canvas sent with the request: stale if the buyer changed it since.
      return {
        shortlist: { ...output.output.shortlist, stale: editedSince(session, request) },
        shortlistRequestAt: request?.at,
      };
    case "compare_products":
      return {
        comparison: { ...output.output.comparison, stale: editedSince(session, request) },
        comparisonRequestAt: request?.at,
      };
  }
}

/** The product the buyer went to check out, if any. */
export function checkoutTargetOf(session: DecisionSession): {
  productId?: string;
  variantId?: string;
  options?: { name: string; label: string }[];
} {
  const target = (session as Session).checkoutTarget;
  if (target) return target;
  return { productId: session.decision.productId, variantId: session.decision.variantId };
}

function sameMessages(a: unknown[], b: unknown[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Returns the same object when nothing changed, so the store can skip a
 * write and React can skip a render.
 */
export function sessionReducer(input: DecisionSession, action: SessionAction): DecisionSession {
  const session: Session = input;
  const touch = (patch: Partial<Session>): Session => ({
    ...session,
    ...patch,
    updatedAt: action.at,
  });

  switch (action.type) {
    case "messages_set": {
      // Search results keep only product IDs here; the records live once in `products`.
      const messages = compactMessages(action.messages);
      if (sameMessages(session.messages, messages)) return session;
      return touch({ messages, products: addMissing(session.products, searchProducts(action.messages)) });
    }

    case "tool_output_applied": {
      if (session.appliedToolCallIds.includes(action.toolCallId)) return session;
      const output = { tool: action.tool, output: action.output } as ToolOutput;
      return touch({
        ...applyToolOutput(session, output, action.request),
        appliedToolCallIds: [...session.appliedToolCallIds, action.toolCallId],
      });
    }

    case "products_merged": {
      const products = mergeProducts(session.products, action.products);
      return products === session.products ? session : touch({ products });
    }

    case "canvas_edited": {
      const canvas = editCanvas(session.canvas, action.edit);
      if (canvas === session.canvas) return session;
      // A confirm changes who said a need, not what it is: the shortlist and
      // comparison still match. It still counts as the buyer's edit, so a reply
      // already on its way keeps it.
      if (isConfirm(action.edit)) return touch({ canvas, canvasEditedAt: action.at });
      return touch({ canvas, canvasEditedAt: action.at, ...markStale(session) });
    }

    case "checkout_started":
      // The decision stays as it was until the buyer says whether they bought.
      return touch({
        checkoutStartedAt: action.at,
        checkoutTarget: {
          productId: action.productId,
          variantId: action.variantId,
          ...(action.options ? { options: action.options } : {}),
        },
      });

    case "checkout_answered": {
      if (!session.checkoutStartedAt) return session;
      if (action.bought) {
        const target = checkoutTargetOf(session);
        const decision: Decision = {
          status: "bought",
          productId: target.productId,
          variantId: target.variantId,
          decidedAt: action.at,
        };
        return touch({ checkoutStartedAt: undefined, checkoutTarget: undefined, decision });
      }
      // "Not yet": the decision they had before is still there.
      return touch({ checkoutStartedAt: undefined, checkoutTarget: undefined });
    }

    case "decided":
      // A purchase is a fact, not a choice to undo: keep "bought".
      if (session.decision.status === "bought") return session;
      return touch({
        checkoutStartedAt: undefined,
        checkoutTarget: undefined,
        decision: {
          status: action.status,
          productId: action.productId,
          variantId: action.variantId,
          decidedAt: action.at,
        },
      });

    case "reason_set":
      if (session.decision.reason === action.reason) return session;
      return touch({ decision: { ...session.decision, reason: action.reason } });

    case "reopened":
      if (session.decision.status === "open") return session;
      return touch({ decision: { status: "open" } });

    case "confidence_submitted":
      return touch({ confidence: action.check });

    case "outcome_submitted":
      return touch({ outcome: action.outcome });
  }
}
