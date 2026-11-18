/**
 * The in-browser session store. One module-level copy of every session,
 * read through `useSyncExternalStore`. On the server it reports "not ready"
 * and never touches `window`.
 */
import { useSyncExternalStore } from "react";
import type { DecisionSession } from "@/pica/lib/types";
import { sessionReducer, type SessionAction } from "./reducer";
import {
  STORAGE_KEY,
  browserStore,
  readSessions,
  writeSessions,
  type StorageHealth,
} from "./storage";

export interface StoreState {
  /** False on the server and during hydration. */
  ready: boolean;
  sessions: Record<string, DecisionSession>;
  health: StorageHealth;
}

const SERVER_STATE: StoreState = { ready: false, sessions: {}, health: "ok" };

let state: StoreState | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function load(): StoreState {
  if (state) return state;
  if (typeof window === "undefined") return SERVER_STATE;
  const result = readSessions(browserStore());
  state = { ready: true, sessions: result.sessions, health: result.health };
  return state;
}

/** Exported for tests. Another tab changed the sessions: read them again. */
export function onStorage(event: Pick<StorageEvent, "key">) {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  // While our own saves fail, memory holds changes the store lacks. Reading
  // the other tab's copy would throw them away, so keep ours.
  if (state && state.health !== "ok") return;
  state = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function getServerSnapshot(): StoreState {
  return SERVER_STATE;
}

function commit(sessions: Record<string, DecisionSession>) {
  // Every write tries the store again: a store that refused once (blocked or
  // full) may work now, and a write that works clears the warning.
  const health = writeSessions(browserStore(), sessions);
  state = { ready: true, sessions, health };
  emit();
}

/* ---------------------------------------------------------------- */
/* Reads                                                             */
/* ---------------------------------------------------------------- */

export function getSession(id: string): DecisionSession | undefined {
  return load().sessions[id];
}

/** Whether the last save worked. */
export function getStoreHealth(): StorageHealth {
  return load().health;
}

export function useSessionStore(): StoreState {
  return useSyncExternalStore(subscribe, load, getServerSnapshot);
}

export function useSession(id: string): {
  ready: boolean;
  session: DecisionSession | undefined;
  health: StorageHealth;
} {
  const store = useSessionStore();
  return { ready: store.ready, session: store.sessions[id], health: store.health };
}

/* ---------------------------------------------------------------- */
/* Writes                                                            */
/* ---------------------------------------------------------------- */

export function addSession(session: DecisionSession) {
  commit({ ...load().sessions, [session.id]: session });
}

export function removeSession(id: string) {
  const sessions = { ...load().sessions };
  if (!(id in sessions)) return;
  delete sessions[id];
  commit(sessions);
}

/**
 * Sessions whose canvas the buyer may not edit right now. Pica's
 * `update_canvas` returns a whole canvas built from the one sent with the
 * request, so an edit made while a reply streams would be overwritten.
 * Kept in memory only: a closed tab must never leave a canvas locked.
 */
const canvasLocks = new Set<string>();

export function setCanvasLocked(id: string, locked: boolean) {
  if (locked) canvasLocks.add(id);
  else canvasLocks.delete(id);
}

export function isCanvasLocked(id: string): boolean {
  return canvasLocks.has(id);
}

/** Returns true when the session changed. Buyer canvas edits are dropped while the canvas is locked. */
export function dispatch(id: string, action: SessionAction): boolean {
  if (action.type === "canvas_edited" && canvasLocks.has(id)) return false;
  const current = load().sessions[id];
  if (!current) return false;
  const next = sessionReducer(current, action);
  if (next === current) return false;
  commit({ ...load().sessions, [id]: next });
  return true;
}

/* ---------------------------------------------------------------- */
/* First message                                                     */
/* ---------------------------------------------------------------- */

const pendingSends = new Set<string>();

/** Ask the workspace to send the session's first message when it opens. */
export function markPendingSend(id: string) {
  pendingSends.add(id);
}

/** True once, for the workspace that should send the first message. */
export function takePendingSend(id: string): boolean {
  return pendingSends.delete(id);
}

/** Test hook: forget the cached state. */
export function resetStoreForTests() {
  state = null;
  pendingSends.clear();
  canvasLocks.clear();
}
