/**
 * Keeps decision sessions in the browser's localStorage under one versioned
 * key. Safe against bad JSON, a blocked store (private mode, settings) and a
 * full store. Never touches `window` at import time.
 */
import type { Canvas, DecisionSession, DecisionStatus } from "@/pica/lib/types";
import { checkoutTargetOf } from "./reducer";

export const STORAGE_KEY = "shop-companion:sessions:v1";
const VERSION = 1;

/** `blocked`: the browser refuses storage. `full`: the last write did not fit. */
export type StorageHealth = "ok" | "blocked" | "full";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STATUSES: readonly DecisionStatus[] = ["open", "saved", "bought", "declined"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A light check: enough to render without crashing. Drops anything else. */
export function isSession(value: unknown): value is DecisionSession {
  if (!isRecord(value)) return false;
  const canvas = value.canvas;
  const decision = value.decision;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number" &&
    typeof value.title === "string" &&
    isRecord(canvas) &&
    Array.isArray(canvas.items) &&
    Array.isArray(value.messages) &&
    Array.isArray(value.appliedToolCallIds) &&
    isRecord(value.products) &&
    isRecord(decision) &&
    STATUSES.includes(decision.status as DecisionStatus)
  );
}

/**
 * The browser's localStorage, or null when it is missing or blocked. Probes
 * with a read: a test write would fail on a full store and cost a write on
 * every call. A store that reads but will not write shows up at the first save.
 */
export function browserStore(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    const store = window.localStorage;
    if (!store) return null;
    store.getItem(STORAGE_KEY);
    return store;
  } catch {
    return null;
  }
}

/**
 * A session saved before the canvas's `intent` became `outcome` keeps its
 * words: the old field is read as the outcome. Same version, same key, so no
 * saved decision is dropped.
 */
function withOutcome(session: DecisionSession): DecisionSession {
  const canvas = session.canvas as Canvas & { intent?: unknown };
  if (canvas.outcome !== undefined && !("intent" in canvas)) return session;
  const { intent, ...rest } = canvas;
  const old: Canvas["outcome"] =
    isRecord(intent) && typeof intent.text === "string" && (intent.source === "stated" || intent.source === "inferred")
      ? { text: intent.text, source: intent.source }
      : null;
  return { ...session, canvas: { ...rest, outcome: rest.outcome ?? old } };
}

export interface ReadResult {
  sessions: Record<string, DecisionSession>;
  health: StorageHealth;
}

export function readSessions(store: StorageLike | null): ReadResult {
  if (!store) return { sessions: {}, health: "blocked" };
  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return { sessions: {}, health: "blocked" };
  }
  if (!raw) return { sessions: {}, health: "ok" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Bad JSON: start clean rather than crash. The next write replaces it.
    return { sessions: {}, health: "ok" };
  }
  if (!isRecord(parsed) || parsed.version !== VERSION || !isRecord(parsed.sessions)) {
    return { sessions: {}, health: "ok" };
  }

  const sessions: Record<string, DecisionSession> = {};
  for (const value of Object.values(parsed.sessions)) {
    if (isSession(value)) sessions[value.id] = withOutcome(value);
  }
  return { sessions, health: "ok" };
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    /quota/i.test(error.message)
  );
}

/**
 * Frees room when the store is full: a finished decision (saved, bought or
 * declined) keeps only the products on its shortlist, comparison, choice and
 * the product the buyer went to check out.
 * Its old search results then show fewer products if reopened.
 */
export function trimForSpace(sessions: Record<string, DecisionSession>): Record<string, DecisionSession> {
  const out: Record<string, DecisionSession> = {};
  for (const [id, session] of Object.entries(sessions)) {
    if (session.decision.status === "open") {
      out[id] = session;
      continue;
    }
    const keep = new Set<string>();
    for (const entry of session.shortlist?.entries ?? []) keep.add(entry.productId);
    for (const productId of session.comparison?.productIds ?? []) keep.add(productId);
    if (session.decision.productId) keep.add(session.decision.productId);
    const target = checkoutTargetOf(session).productId;
    if (target) keep.add(target);
    const products: DecisionSession["products"] = {};
    for (const productId of keep) {
      const product = session.products[productId];
      if (product) products[productId] = product;
    }
    out[id] = { ...session, products };
  }
  return out;
}

function trySet(store: StorageLike, sessions: Record<string, DecisionSession>): StorageHealth {
  let body: string;
  try {
    body = JSON.stringify({ version: VERSION, sessions });
  } catch {
    return "full";
  }
  try {
    store.setItem(STORAGE_KEY, body);
    return "ok";
  } catch (error) {
    return isQuotaError(error) ? "full" : "blocked";
  }
}

/** Never throws. A full store gets one retry with finished decisions trimmed. */
export function writeSessions(
  store: StorageLike | null,
  sessions: Record<string, DecisionSession>,
): StorageHealth {
  if (!store) return "blocked";
  const health = trySet(store, sessions);
  if (health !== "full") return health;
  return trySet(store, trimForSpace(sessions));
}
