/**
 * The visitor's OpenAI key, kept in this browser tab only.
 *
 * It lives in `sessionStorage`, so it is gone when the tab closes and other
 * tabs never see it. Never localStorage, never a cookie: the key must not
 * outlast the tab or ride along on requests by itself. The chat transport
 * reads it at send time and puts it in one header (`OPENAI_KEY_HEADER`).
 *
 * Storage can throw (private windows, blocked site data), so every call is
 * wrapped: a read that fails finds no key, and a save that fails says so.
 */
import { OPENAI_KEY_HEADER } from "@/pica/lib/pica/constants";

const ENTRY = "pica.openaiKey";

function tabStorage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** The key kept in this tab, or null. */
export function readVisitorKey(): string | null {
  try {
    return tabStorage()?.getItem(ENTRY) || null;
  } catch {
    return null;
  }
}

/** Keep the key in this tab. False when the browser won't store it. */
export function saveVisitorKey(key: string): boolean {
  try {
    const storage = tabStorage();
    if (!storage) return false;
    storage.setItem(ENTRY, key);
    return true;
  } catch {
    return false;
  }
}

/** Drop the key from this tab. */
export function forgetVisitorKey(): void {
  try {
    tabStorage()?.removeItem(ENTRY);
  } catch {
    // Nothing to do: a tab that can't store a key holds none.
  }
}

/** Headers for a chat request: the key's header when this tab holds a key, else none. */
export function visitorKeyHeaders(): Record<string, string> {
  const key = readVisitorKey();
  return key ? { [OPENAI_KEY_HEADER]: key } : {};
}
