"use client";

import { BASE } from "@/pica/lib/base";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO } from "@/pica/features/demo/demo-script";
import { postJson, requestJson } from "@/pica/features/shared/api";
import { startDemo } from "@/pica/features/shared/startDecision";
import { setupStatusFrom, type SetupStatus } from "./setup-model";

interface SetupReply {
  hasKey: boolean;
  /** The key is the server's env key, which Home can't forget. */
  fromEnv: boolean;
  /** This server takes a pasted key: false on a hosted copy. */
  canAdd: boolean;
}

/**
 * Home's first-run state. Asks the local server whether it holds an OpenAI
 * key; with none, Home shows the choice. Where a key can't be added (not
 * local, or a production build), the choice is the demo alone. If the route
 * fails, Home stays as it was and offers no change.
 */
export function useSetup() {
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus>("checking");
  const [hasKey, setHasKey] = useState(false);
  const [fromEnv, setFromEnv] = useState(false);
  // The server takes a key, so the choice can be opened again later.
  const [canAdd, setCanAdd] = useState(false);
  // "Change setup" opened the choice while a key is kept.
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    let live = true;
    void requestJson<SetupReply>(`${BASE}/api/setup`, { cache: "no-store" }).then((result) => {
      if (!live) return;
      setStatus(setupStatusFrom(result));
      setCanAdd(result.ok && result.data?.canAdd === true);
      setHasKey(result.ok && result.data?.hasKey === true);
      setFromEnv(result.ok && result.data?.fromEnv === true);
    });
    return () => {
      live = false;
    };
  }, []);

  /** Resolves to an error to show, or null once the server keeps the key. */
  async function saveKey(apiKey: string): Promise<string | null> {
    const result = await postJson<SetupReply>(`${BASE}/api/setup`, { apiKey });
    if (!result.ok) return result.error.message;
    setHasKey(true);
    setFromEnv(result.data?.fromEnv === true);
    setStatus("ready");
    setChoosing(false);
    return null;
  }

  async function forgetKey() {
    const result = await requestJson<SetupReply>(`${BASE}/api/setup`, { method: "DELETE" });
    if (!result.ok) return;
    // A key from the environment stays; only the pasted one goes.
    const kept = result.data?.hasKey === true;
    setHasKey(kept);
    setStatus(kept ? "ready" : "needed");
    setChoosing(false);
  }

  function demo() {
    const id = startDemo(DEMO.title);
    router.push(`${BASE}/d/${id}`);
  }

  return {
    status,
    hasKey,
    canAdd,
    /** A pasted key is in use, so "Forget my key" can do something. */
    canForget: hasKey && !fromEnv,
    /** Show the choice in place of the goal box. */
    showChoice: status === "needed" || choosing,
    /** Offer "Change setup" at the foot. */
    canChange: canAdd && status === "ready" && !choosing,
    change: () => setChoosing(true),
    keep: () => setChoosing(false),
    saveKey,
    forgetKey,
    demo,
  };
}
