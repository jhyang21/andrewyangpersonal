/**
 * Home's first-run choice: the buyer's own OpenAI key, held in the local
 * server's memory, or the scripted demo. Words and pure rules only.
 */

export type SetupChoice = "key" | "demo";

/** Where Home stands: asking the server, needs a choice, or ready to chat. */
export type SetupStatus = "checking" | "needed" | "ready";

export const SETUP = {
  heading: "How do you want to start?",
  line: "Pica needs an OpenAI key to chat. Without one, you can watch a set example.",
  /** Where a key can't be added: a hosted copy, not one on the buyer's own computer. */
  demoOnlyLine: "This copy of Pica runs without an OpenAI key, so it can't chat. You can watch a set example of how it works.",
  keyLabel: "Use my OpenAI key",
  keyHint: "Kept in this computer's server memory only, never saved to disk. Paste it again after a restart.",
  keyField: "OpenAI API key",
  demoLabel: "Try the demo",
  demoHint: "Press Next to step from a goal to a comparison. It follows a script and makes no AI calls.",
  next: "Next",
  checking: "Checking your key",
  emptyKey: "Paste your OpenAI key. It starts with sk-.",
  badShape: "That doesn't look like an OpenAI key. It starts with sk- and has no spaces.",
  change: "Change setup",
  forget: "Forget my key",
  keep: "Keep my key",
} as const;

/** The same shape the server checks: sk-, then 17 to 197 more characters, no spaces. */
const KEY_SHAPE = /^sk-\S{17,197}$/;

/** What is wrong with the pasted key before it is sent, or null. */
export function keyProblem(raw: string): string | null {
  const key = raw.trim();
  if (!key) return SETUP.emptyKey;
  return KEY_SHAPE.test(key) ? null : SETUP.badShape;
}

/** Home's status from `GET /api/setup`. Anything but a clear "no key" leaves Home as it was. */
export function setupStatusFrom(result: { ok: true; data: unknown } | { ok: false }): SetupStatus {
  if (!result.ok) return "ready";
  const data = result.data as { hasKey?: unknown } | null;
  return data?.hasKey === false ? "needed" : "ready";
}
