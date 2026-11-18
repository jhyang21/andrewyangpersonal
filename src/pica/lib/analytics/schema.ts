/**
 * The shape of one analytics event, shared by `track()` and `POST /api/events`.
 * Props hold IDs, counts and enums only: no free text, no URLs, no emails.
 */
import { z } from "zod";
import { EVENTS, type EventName } from "@/pica/lib/events";

export type EventPropValue = string | number | boolean | null;
export type EventProps = Record<string, EventPropValue>;

const KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
const MAX_PROPS = 20;
const MAX_STRING = 120;

/**
 * A prop string must look like an ID or an enum: no spaces (free text has
 * them), no web links, no emails. Shopify `gid://` IDs are allowed.
 * Links without a scheme ("shop.example/checkout") are refused too: no ID or
 * enum here has a slash or a dotted host name.
 */
export function isSafePropString(value: string): boolean {
  if (value.length > MAX_STRING) return false;
  if (/\s/.test(value)) return false;
  if (/@/.test(value)) return false;
  if (value.startsWith("gid://shopify/")) return !/[?#]/.test(value);
  if (/[/\\?#]|%2f/i.test(value)) return false;
  if (/:/.test(value)) return false;
  // A host name: letters, a dot, then a letter run ("shop.example", "www.x.com").
  if (/[a-z0-9-]\.[a-z]{2,}/i.test(value)) return false;
  return true;
}

const propValue = z.union([
  z.string().refine(isSafePropString),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const analyticsEventSchema = z.object({
  name: z.enum(EVENTS as unknown as [EventName, ...EventName[]]),
  sessionId: z.string().max(100).refine(isSafePropString).nullable(),
  at: z.number().int().positive(),
  props: z
    .record(z.string().regex(KEY), propValue)
    .refine((props) => Object.keys(props).length <= MAX_PROPS),
});

/** Drop any prop that would fail the server check, so one bad prop never loses the event. */
export function cleanProps(props: Record<string, unknown>): EventProps {
  const out: EventProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (Object.keys(out).length >= MAX_PROPS) break;
    if (!KEY.test(key)) continue;
    if (value === null || typeof value === "boolean") out[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "string" && isSafePropString(value)) out[key] = value;
  }
  return out;
}
