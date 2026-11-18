/**
 * Send one journey event to `POST /api/events`. Fire and forget: analytics
 * never blocks or breaks the buyer's flow.
 */
import { BASE } from "@/pica/lib/base";
import type { AnalyticsEvent, EventName } from "@/pica/lib/events";
import { cleanProps, type EventPropValue } from "./schema";

export const EVENTS_ENDPOINT = `${BASE}/api/events`;

export function track(
  name: EventName,
  props: Record<string, EventPropValue | undefined> = {},
  sessionId: string | null = null,
): void {
  if (typeof window === "undefined") return;
  const event: AnalyticsEvent = {
    name,
    sessionId,
    at: Date.now(),
    props: cleanProps(props),
  };
  try {
    void fetch(EVENTS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never throw into the page.
  }
}
