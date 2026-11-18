/**
 * What the page needs from Pica, safe for client components.
 * Type-only imports keep server code (tools, prompt, catalog) out of the bundle.
 *
 *   import { type PicaUIMessage, MAX_QUESTIONS } from "@/pica/lib/pica/client";
 *   const chat = useChat<PicaUIMessage>({ ... });
 */
import type { InferUITools, UIDataTypes, UIMessage } from "ai";
import type { PicaToolSet } from "./tools";

export {
  COMPARE_MAX,
  COMPARE_MIN,
  MAX_QUESTIONS,
  PICA_MESSAGES,
  SHORTLIST_MAX,
  SHORTLIST_MIN,
} from "./constants";

/** Typed tools for `useChat`. Parts are `tool-update_canvas`, `tool-ask_question` and so on. */
export type PicaUITools = InferUITools<PicaToolSet>;

/** The UI message type for `useChat<PicaUIMessage>()`. */
export type PicaUIMessage = UIMessage<unknown, UIDataTypes, PicaUITools>;

/** Any tool part in a Pica message. */
export type PicaToolPart = Extract<PicaUIMessage["parts"][number], { type: `tool-${string}` }>;
