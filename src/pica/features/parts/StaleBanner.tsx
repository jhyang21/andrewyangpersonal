"use client";

import { Banner } from "@/pica/components/kit";
import type { DecisionSession } from "@/pica/lib/types";
import { STALE_MESSAGE } from "@/pica/features/workspace/views";

export const STALE_BANNER = {
  title: "Your needs changed after this shortlist",
  body: "These options and any comparison reflect your earlier needs. Ask Pica to update them.",
  action: "Update the options",
} as const;

export interface StaleBannerProps {
  session: DecisionSession;
  /** True while Pica replies. The action hides until it is done. */
  busy: boolean;
  /**
   * Sends a chat message, such as `ws.send`. The chat context already
   * carries the canvas change.
   */
  onSend: (text: string) => void;
  className?: string;
}

/**
 * A caution over Options and Compare once the buyer changes a need after the
 * options came. Shows only while the shortlist is marked stale.
 */
export function StaleBanner({ session, busy, onSend, className }: StaleBannerProps) {
  if (!session.shortlist?.stale) return null;
  return (
    <Banner
      tone="caution"
      title={STALE_BANNER.title}
      action={busy ? undefined : { label: STALE_BANNER.action, onClick: () => onSend(STALE_MESSAGE) }}
      className={className}
    >
      {STALE_BANNER.body}
    </Banner>
  );
}
