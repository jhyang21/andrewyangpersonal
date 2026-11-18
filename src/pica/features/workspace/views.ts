/** The workspace's three views. The needs are not a view: they sit beside every view. */
export type WorkspaceView = "chat" | "options" | "compare";

export const WORKSPACE_VIEWS: readonly WorkspaceView[] = ["chat", "options", "compare"];

/** Older names a link or a saved tab may still carry. */
const OLD_NAMES = new Map<string, WorkspaceView>([
  ["shortlist", "options"],
  ["canvas", "chat"],
]);

/**
 * Reads a view from a URL value such as `?view=options`. Older names map to
 * their new view ("shortlist" is Options; "canvas" is Chat with the needs
 * open). Anything else, missing or malformed, is Chat. Never throws.
 */
export function parseView(value: unknown): WorkspaceView {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return "chat";
  const name = raw.trim().toLowerCase();
  if ((WORKSPACE_VIEWS as readonly string[]).includes(name)) return name as WorkspaceView;
  return OLD_NAMES.get(name) ?? "chat";
}

/** True when a URL value asks for the needs to open: the old "canvas" tab. */
export function opensCanvas(value: unknown): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim().toLowerCase() === "canvas";
}

export const STALE_MESSAGE = "I changed my goal or needs on the canvas. Update the shortlist to match.";
