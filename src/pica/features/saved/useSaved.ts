"use client";

import { useState } from "react";
import { removeSession, useSessionStore } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { askCardId, groupSessions } from "./saved-model";

/** The Saved list, the remove confirm, and the check-in sheet. */
export function useSaved() {
  const { ready, sessions } = useSessionStore();
  const [removing, setRemoving] = useState<DecisionSession | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const groups = groupSessions(sessions);

  return {
    ready,
    groups,
    empty: groups.length === 0,
    /** The one card the brief's Saved asks "Did you buy it?" on. */
    askCardId: askCardId(sessions),
    /** The decision waiting on "Remove decision", if any. */
    removing,
    askRemove: (session: DecisionSession) => setRemoving(session),
    keep: () => setRemoving(null),
    confirmRemove() {
      if (removing) removeSession(removing.id);
      setRemoving(null);
    },
    /** The decision the check-in sheet is open for. Null once it is removed. */
    checkInSession: checkingIn ? (sessions[checkingIn] ?? null) : null,
    openCheckIn: (id: string) => setCheckingIn(id),
    closeCheckIn: () => setCheckingIn(null),
  };
}
