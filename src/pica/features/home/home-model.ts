/**
 * Home (brief 6.1): the examples, what a send starts, and the decision to
 * pick up. Pure.
 */
import { BASE } from "@/pica/lib/base";
import type { PicaPose } from "@/pica/components/mascot";
import { CATEGORIES, type Category, type DecisionSession } from "@/pica/lib/types";
import type { StartInput } from "@/pica/features/shared/startDecision";
import { CATEGORY_WORDS } from "@/pica/features/shared/categories";
import { decisionFacts } from "@/pica/features/saved/saved-card-model";

/**
 * Examples that fill the box when tapped. Each answers the heading: life
 * once the buyer owns the right bag, not the bag. Each knows its category.
 */
export const EXAMPLES: readonly { text: string; category: Category }[] = [
  { text: "My shoulder no longer aches after the commute", category: "backpack" },
  { text: "Two weeks in Japan without checking a bag", category: "luggage" },
  { text: "I go from the office to dinner with one bag", category: "bag" },
];

/** The category links at the foot, in the brief's order. */
export const CATEGORY_LINKS: readonly { category: Category; label: string }[] = CATEGORIES.map((category) => ({
  category,
  label: CATEGORY_WORDS[category].many,
}));

export const HOME = {
  heading: "What does your life look like after you get your ideal bag?",
  /** The goal box's label, read by screen readers: it answers the heading. */
  boxLabel: "Describe your life once you have the right bag",
  /** The goal box's placeholder: one more picture of life after, not a product. */
  placeholder: "A week away, and everything fits in one bag",
  scope: "Pica looks across products from Shopify merchants, not every shop on the web.",
  examples: "Examples",
  resumeHeading: "Pick up where you left off",
  resume: "Resume",
  allSaved: "See your other decisions on Saved",
  browse: "Or browse products",
  starting: "Opening your decision",
} as const;

/**
 * What a send starts. `goal_stated` goes out once, on send, never on a
 * chip tap: a filled box is not yet a goal. Text sent exactly as a chip
 * filled it counts as that example, with its category; anything else, an
 * edited example included, is the buyer's own words from Home.
 */
export function openerFor(text: string): StartInput {
  const example = EXAMPLES.find((item) => item.text === text);
  return example ? { text, source: "example", category: example.category } : { text, source: "home" };
}

/**
 * What an example chip does to the box. It fills the box only while the box
 * is empty or still holds an example's words, trimmed; it never replaces
 * what the buyer typed. When it cannot fill, or the box already holds these
 * exact words, it only moves focus to the box.
 */
export function chipTap(current: string, example: string): { kind: "fill"; text: string } | { kind: "focus" } {
  if (current === example) return { kind: "focus" };
  const kept = current.trim();
  const free = kept === "" || EXAMPLES.some((item) => item.text === kept);
  return free ? { kind: "fill", text: example } : { kind: "focus" };
}

/**
 * Holds a send open while its decision starts. `send` starts the decision
 * once and returns a promise, which the box's gate waits on, so a second
 * Enter in the same moment is ignored. `busyChanged(false)` (the hook freed
 * its controls) and `hide()` (the page hid or closed) settle the promise.
 * Settling twice, or with no send held, does nothing.
 */
export function sendGate() {
  let release: (() => void) | null = null;
  const open = () => {
    release?.();
    release = null;
  };
  return {
    send(text: string, start: (input: StartInput) => void): Promise<void> {
      return new Promise<void>((resolve) => {
        release = resolve;
        start(openerFor(text));
      });
    },
    busyChanged(busy: boolean) {
      if (!busy) open();
    },
    hide: open,
  };
}

/** Pica waits at rest, and listens once there is text in the box. */
export function homePose(text: string): Extract<PicaPose, "idle" | "listening"> {
  return text.trim() ? "listening" : "idle";
}

export interface ResumeCard {
  title: string;
  facts: string;
  href: string;
  /** Open decisions besides this one. Saved lists them. */
  others: number;
}

/** The newest open decision, to pick up from Home. Null when none is open. */
export function resumeCard(sessions: Record<string, DecisionSession>): ResumeCard | null {
  const open = Object.values(sessions)
    .filter((session) => session.decision.status === "open")
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const newest = open[0];
  if (!newest) return null;
  return {
    title: newest.title,
    facts: decisionFacts(newest),
    href: `${BASE}/d/${newest.id}`,
    others: open.length - 1,
  };
}
