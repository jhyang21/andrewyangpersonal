/**
 * Home's first-run choice: the visitor's own OpenAI key, or the scripted demo.
 * The key is checked once by `/api/setup`, then kept in this browser tab only
 * (see `@/pica/features/shared/visitor-key`) and sent with each chat request.
 * Words and pure rules only.
 */
import { OPENAI_KEY_SHAPE } from "@/pica/lib/pica/constants";

export type SetupChoice = "key" | "demo";

/** Where Home stands: reading the tab, needs a choice, or ready to chat. */
export type SetupStatus = "checking" | "needed" | "ready";

export const SETUP = {
  heading: "How do you want to start?",
  line: "Pica needs an OpenAI key to chat. Without one, you can watch a set example.",
  keyLabel: "Use my OpenAI key",
  keyHint:
    "Your key stays in this tab and goes only to OpenAI, through this site's server. Nothing saves it. Use a key with a low spending limit, and revoke it when you're done.",
  keyField: "OpenAI API key",
  demoLabel: "Try the demo",
  demoHint: "Press Next to step from a goal to a comparison. It follows a script and makes no AI calls.",
  next: "Next",
  checking: "Checking your key",
  emptyKey: "Paste your OpenAI key. It starts with sk-.",
  badShape: "That doesn't look like an OpenAI key. It starts with sk- and has no spaces.",
  /** The key passed OpenAI's check, but this browser won't keep it in the tab. */
  noStorage: "This browser won't keep your key in this tab. Allow site data for this page, or try the demo.",
  change: "Change setup",
  forget: "Forget my key",
  keep: "Keep my key",
} as const;

/** What is wrong with the pasted key before it is sent, or null. */
export function keyProblem(raw: string): string | null {
  const key = raw.trim();
  if (!key) return SETUP.emptyKey;
  return OPENAI_KEY_SHAPE.test(key) ? null : SETUP.badShape;
}
