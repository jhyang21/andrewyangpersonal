"use client";

import { useState } from "react";

/**
 * Whether the reply under way is one this control asked for, so it can show
 * a spinner or grey shapes for its own reply only. Call `asked()` once
 * `ws.send` accepts the message; `mine` stays true until Pica stops replying.
 */
export function useOwnReply(busy: boolean): { mine: boolean; asked: () => void } {
  // "sent" until Pica starts, "working" until Pica stops.
  const [phase, setPhase] = useState<"idle" | "sent" | "working">("idle");
  if (phase === "sent" && busy) setPhase("working");
  if (phase === "working" && !busy) setPhase("idle");
  return { mine: phase !== "idle" && busy, asked: () => setPhase("sent") };
}
