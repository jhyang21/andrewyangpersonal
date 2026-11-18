/**
 * Analytics event names (PRD section 8). `track()` in `src/pica/lib/analytics`
 * accepts only these. Props must never hold checkout URLs, emails or free text
 * the buyer typed.
 */
export const EVENTS = [
  "goal_stated",
  "question_answered",
  "question_skipped",
  "requirement_edited",
  "recommendation_viewed",
  "comparison_viewed",
  "evidence_viewed",
  "review_link_opened",
  "checkout_initiated",
  "purchase_completed",
  "session_saved",
  "session_resumed",
  "no_purchase_decided",
  "confidence_submitted",
  "satisfaction_submitted",
  "error_shown",
] as const;

export type EventName = (typeof EVENTS)[number];

export interface AnalyticsEvent {
  name: EventName;
  sessionId: string | null;
  at: number;
  props: Record<string, string | number | boolean | null>;
}
