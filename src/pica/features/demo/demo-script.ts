/**
 * The scripted demo: four buyer turns, each with Pica's set reply. Each reply
 * is the same tool outputs a live reply carries, so the workspace shows them
 * through its usual path. Pure: time and the current canvas are passed in.
 */
import type { ToolOutput } from "@/pica/lib/session";
import type { Canvas, CanvasItem, CatalogProduct } from "@/pica/lib/types";
import { compareRequestText } from "@/pica/features/workspace/compare-model";
import type { WorkspaceView } from "@/pica/features/workspace/views";
import { demoComparedProducts, demoComparison, demoProducts, demoShortlist } from "./demo-data";

/** What a scripted reply can read from the session when it is sent. */
export interface DemoContext {
  at: number;
  canvas: Canvas;
  /** Products the session holds, by ID. */
  products: Record<string, CatalogProduct>;
}

export type DemoPart = { kind: "text"; text: string } | ({ kind: "tool"; input: unknown } & ToolOutput);

export interface DemoStep {
  /** The buyer's message that Next sends. */
  buyer: string;
  /** What Next does, shown in the demo bar before it is pressed. */
  caption: string;
  /** The view to show once Pica's reply is in. */
  view: WorkspaceView;
  reply: (context: DemoContext) => DemoPart[];
}

export const DEMO = {
  title: "Demo: a commute backpack",
  bar: "Demo",
  next: "Next",
  leave: "Leave demo",
  done: "That's the demo. Add your OpenAI key on Home to chat with Pica for real.",
  offScript: "In the demo I follow a script. Press Next to go on, or add your OpenAI key on Home to chat for real.",
} as const;

const GOAL = "My shoulder no longer aches after the commute";

const COMFORT: CanvasItem = { id: "demo-comfort", kind: "must_have", text: "Comfortable for a 30-minute walk", source: "inferred" };
const RAIN: CanvasItem = { id: "demo-rain", kind: "must_have", text: "Holds up in rain", source: "inferred" };
const LAPTOP: CanvasItem = { id: "demo-laptop", kind: "must_have", text: "Fits a 16-inch laptop", source: "stated" };

/** The canvas with these items added. An item the buyer already has, by ID, keeps the buyer's version. */
function withItems(canvas: Canvas, items: CanvasItem[]): CanvasItem[] {
  const have = new Set(canvas.items.map((item) => item.id));
  return [...canvas.items, ...items.filter((item) => !have.has(item.id))];
}

/** The session's demo products, or fresh ones when they are missing. */
function productsFor({ at, products }: DemoContext): CatalogProduct[] {
  const fresh = demoProducts(at);
  const held = fresh.map((product) => products[product.id]);
  return held.every(Boolean) ? (held as CatalogProduct[]) : fresh;
}

export const DEMO_STEPS: readonly DemoStep[] = [
  {
    buyer: GOAL,
    caption: "Next sends a goal to Pica.",
    view: "chat",
    reply: ({ canvas }) => {
      const next: Canvas = {
        ...canvas,
        category: "backpack",
        outcome: { text: GOAL, source: "stated" },
        items: withItems(canvas, [COMFORT, RAIN]),
      };
      const question = {
        question: "What size laptop do you carry?",
        why: "Most packs list the largest laptop they take, so the answer rules some out.",
        options: ["13 or 14 inches", "15 inches", "16 inches", "No laptop"],
      };
      return [
        {
          kind: "text",
          text: "A commute that leaves your shoulder alone is a good place to start. I've guessed two needs from it; tell me if either is wrong.",
        },
        { kind: "tool", tool: "update_canvas", input: next, output: { canvas: next } },
        { kind: "tool", tool: "ask_question", input: question, output: { question } },
      ];
    },
  },
  {
    buyer: "16 inches, and I'd rather stay under $150",
    caption: "Next answers Pica's question.",
    view: "chat",
    reply: ({ canvas }) => {
      const next: Canvas = { ...canvas, budget: { maxUsd: 150, source: "stated" }, items: withItems(canvas, [LAPTOP]) };
      return [
        { kind: "tool", tool: "update_canvas", input: next, output: { canvas: next } },
        { kind: "text", text: "Got it: a 16-inch laptop and $150 at most. That's enough for me to look." },
      ];
    },
  },
  {
    buyer: "Show me options",
    caption: "Next asks Pica for options.",
    view: "options",
    reply: (context) => {
      const products = productsFor(context);
      const query = { query: "commute backpack for a 16-inch laptop", category: "backpack", maxPriceUsd: 150 };
      return [
        { kind: "tool", tool: "search_catalog", input: query, output: { products, totalCount: products.length } },
        { kind: "tool", tool: "present_shortlist", input: {}, output: { shortlist: demoShortlist(products, context.at) } },
        { kind: "text", text: "Here are four to look at. One is sold out and one doesn't list its stock." },
      ];
    },
  },
  {
    buyer: compareRequestText(demoComparedProducts(demoProducts(0))),
    caption: "Next compares three of them.",
    view: "compare",
    reply: (context) => {
      const comparison = demoComparison(productsFor(context), context.at);
      return [
        { kind: "tool", tool: "compare_products", input: { productIds: comparison.productIds }, output: { comparison } },
        {
          kind: "text",
          text: "Here are three side by side on your needs. No listing says how the straps feel, so I've marked that as missing.",
        },
      ];
    },
  },
];

export interface MessageLike {
  role: string;
  parts: readonly { type: string; text?: string }[];
}

function textOf(message: MessageLike): string {
  return message.parts
    .map((part) => (part.type === "text" ? (part.text ?? "") : ""))
    .join("")
    .trim();
}

/** How many scripted turns the buyer has sent, in order. Typed messages between them don't count. */
export function demoProgress(messages: readonly MessageLike[]): number {
  let next = 0;
  for (const message of messages) {
    if (message.role !== "user" || next >= DEMO_STEPS.length) continue;
    if (textOf(message) === DEMO_STEPS[next].buyer) next += 1;
  }
  return next;
}

/** The step the last message starts, or null when it is not the next scripted turn. */
export function stepForReply(messages: readonly MessageLike[]): number | null {
  const last = messages.at(-1);
  if (!last || last.role !== "user") return null;
  const index = demoProgress(messages.slice(0, -1));
  return index < DEMO_STEPS.length && textOf(last) === DEMO_STEPS[index].buyer ? index : null;
}

/** Pica's set reply to the last message: the step's reply, or the off-script line. */
export function demoReply(messages: readonly MessageLike[], context: DemoContext): { id: string; parts: DemoPart[] } {
  const step = stepForReply(messages);
  if (step === null) return { id: `demo-aside-${context.at}`, parts: [{ kind: "text", text: DEMO.offScript }] };
  return { id: `demo-${step + 1}`, parts: DEMO_STEPS[step].reply(context) };
}
