"use client";

import { useEffect } from "react";
import { firstTime, track } from "@/pica/lib/analytics";
import { useSessionStore, type StorageHealth } from "@/pica/lib/session";

/**
 * Whether saving fails in this browser, and why. Null while the store loads
 * and while saving works. Counts `error_shown` once per page load per cause,
 * however many screens show the warning.
 */
export function useStorageNotice(): Exclude<StorageHealth, "ok"> | null {
  const { ready, health } = useSessionStore();

  useEffect(() => {
    if (ready && health !== "ok" && firstTime(`storage_${health}`)) {
      track("error_shown", { code: `storage_${health}`, where: "storage" });
    }
  }, [ready, health]);

  return ready && health !== "ok" ? health : null;
}
