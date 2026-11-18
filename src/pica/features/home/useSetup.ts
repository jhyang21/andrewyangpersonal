"use client";

import { BASE } from "@/pica/lib/base";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO } from "@/pica/features/demo/demo-script";
import { postJson } from "@/pica/features/shared/api";
import { startDemo } from "@/pica/features/shared/startDecision";
import { forgetVisitorKey, readVisitorKey, saveVisitorKey } from "@/pica/features/shared/visitor-key";
import { SETUP, type SetupStatus } from "./setup-model";

/**
 * Home's first-run state. A key kept in this tab means Pica can chat; with
 * none, Home shows the choice. A pasted key is checked once by `/api/setup`,
 * which stores nothing, then kept in this tab only.
 */
export function useSetup() {
  const router = useRouter();
  // "checking" until the tab is read after mount: the server render can't see the tab.
  const [status, setStatus] = useState<SetupStatus>("checking");
  // "Change setup" opened the choice while a key is kept.
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    // Reading the tab's storage has to wait for the browser, so the first
    // render matches the server's. One read, once, on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tab storage exists only after hydration
    setStatus(readVisitorKey() ? "ready" : "needed");
  }, []);

  /** Resolves to an error to show, or null once the tab keeps the key. */
  async function saveKey(apiKey: string): Promise<string | null> {
    const result = await postJson<{ ok: true }>(`${BASE}/api/setup`, { apiKey });
    if (!result.ok) return result.error.message;
    if (!saveVisitorKey(apiKey)) return SETUP.noStorage;
    setStatus("ready");
    setChoosing(false);
    return null;
  }

  function forgetKey() {
    forgetVisitorKey();
    setStatus("needed");
    setChoosing(false);
  }

  function demo() {
    const id = startDemo(DEMO.title);
    router.push(`${BASE}/d/${id}`);
  }

  const hasKey = status === "ready";
  return {
    status,
    hasKey,
    /** Show the choice in place of the goal box. */
    showChoice: status === "needed" || choosing,
    /** Offer "Change setup" at the foot. */
    canChange: hasKey && !choosing,
    change: () => setChoosing(true),
    keep: () => setChoosing(false),
    saveKey,
    forgetKey,
    demo,
  };
}
