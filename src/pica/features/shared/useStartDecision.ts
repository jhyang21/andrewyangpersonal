"use client";

import { BASE } from "@/pica/lib/base";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { startDecision, type StartInput } from "./startDecision";

/**
 * Starts a new decision and opens it. Home, the example chips and Browse's
 * "Ask Pica about this" all use it. `goal_stated` fires once, from
 * `startDecision`; a second press while busy does nothing.
 */
export function useStartDecision() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Next keeps the page, hidden, after we leave it. Free the controls as it
  // hides, so Back shows them ready again.
  useLayoutEffect(() => () => setBusy(false), []);

  function start(input: StartInput) {
    if (busy) return;
    setBusy(true);
    const id = startDecision(input);
    router.push(`${BASE}/d/${id}`);
  }

  return { busy, start };
}
