/**
 * Starts a new decision from Home, an example chip or Browse: the buyer's
 * first message is stored, and the workspace sends it when it opens.
 */
import { track } from "@/pica/lib/analytics";
import { addSession, createSession, markPendingSend, userMessage } from "@/pica/lib/session";
import { EMPTY_CANVAS, type CatalogProduct, type Category } from "@/pica/lib/types";
import { newId } from "./format";

export type OpenerSource = "home" | "example" | "browse";

export interface StartInput {
  text: string;
  source: OpenerSource;
  category?: Category | null;
  product?: CatalogProduct;
}

export function startDecision({ text, source, category = null, product }: StartInput): string {
  const id = newId();
  const at = Date.now();
  addSession(
    createSession({
      id,
      at,
      title: product ? product.title : text,
      messages: [userMessage(newId(), text)],
      canvas: category ? { ...EMPTY_CANVAS, category } : EMPTY_CANVAS,
      products: product ? [product] : [],
    }),
  );
  markPendingSend(id);
  track("goal_stated", { source, category: category ?? null, length: text.length }, id);
  return id;
}

/**
 * Starts the scripted demo: an empty demo decision. Nothing is sent and
 * nothing is tracked; the workspace's demo bar sends each turn on Next.
 */
export function startDemo(title: string): string {
  const id = newId();
  addSession(createSession({ id, at: Date.now(), title, demo: true }));
  return id;
}
