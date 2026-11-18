/**
 * Events that must count once per page load, such as `session_resumed`.
 * Module state: it resets on a full reload, which is a new page load.
 */
const fired = new Set<string>();

/** True the first time it sees `key` in this page load, false after. */
export function firstTime(key: string): boolean {
  if (fired.has(key)) return false;
  fired.add(key);
  return true;
}

/** Test hook. */
export function resetOnceForTests() {
  fired.clear();
}
