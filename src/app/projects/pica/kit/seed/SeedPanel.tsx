"use client";

import { BASE } from "@/pica/lib/base";
import Link from "next/link";
import { useState } from "react";
import { addSession } from "@/pica/lib/session";
import { SEED_ID, seedDecision } from "./fixture";

/**
 * Writes the seed decision into this browser's session store, then links to
 * it. Plain elements on purpose: the page needs nothing from the kit.
 */
export function SeedPanel() {
  const [written, setWritten] = useState(false);

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>Seed a decision</h1>
      <p style={{ marginTop: 8 }}>
        Writes one made-up decision into this browser: needs, a guess to confirm, an open question, four options (one
        sold out, one with unknown stock), a shortlist note and a comparison. It replaces an earlier seed. Nothing is
        sent anywhere.
      </p>
      <p style={{ marginTop: 8 }}>
        The products are made up, so the Decide page can&apos;t load them from the catalog.
      </p>
      <button
        type="button"
        onClick={() => {
          addSession(seedDecision(Date.now()));
          setWritten(true);
        }}
        style={{ marginTop: 16, minHeight: 44, padding: "0 16px", borderRadius: 999, border: "1px solid currentColor" }}
      >
        Write the seed decision
      </button>
      <p role="status" style={{ marginTop: 16 }}>
        {written ? (
          <>
            Written. <Link href={`${BASE}/d/${SEED_ID}`} style={{ textDecoration: "underline" }}>Open the seed decision</Link>
          </>
        ) : null}
      </p>
    </main>
  );
}
