"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote } from "@/components/final-shift/ErrorNote";
import { COPY } from "@/lib/final-shift/copy";
import { adminLogin, ApiError } from "@/lib/final-shift/net";

/**
 * The passphrase gate.
 *
 * The only client component on this screen. Everything behind it renders on the server, so a wrong
 * passphrase never gets a payload to inspect — there is nothing in the page to withhold.
 */
export function AdminLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const passphrase = new FormData(event.currentTarget).get("passphrase");
    setBusy(true);
    setError(null);
    try {
      await adminLogin(typeof passphrase === "string" ? passphrase : "");
      // The cookie is set; the server render is what decides what this route shows.
      router.refresh();
    } catch (failure) {
      const code = failure instanceof ApiError ? failure.code : "temporary";
      setError(
        code === "bad_passphrase"
          ? COPY.admin.errors.bad
          : code === "rate_limited"
            ? COPY.admin.errors.rateLimited
            : COPY.admin.errors.temporary,
      );
      setBusy(false);
    }
  };

  return (
    <main className="fs-stage">
      <div />
      <form onSubmit={submit} className="self-center">
        <h1 className="fs-title text-[var(--fs-cream)]">
          {COPY.admin.lockHeading}
        </h1>
        <p className="fs-body mt-2 text-[var(--fs-oat)]">
          {COPY.admin.lockSupport}
        </p>

        <label
          htmlFor="fs-admin-passphrase"
          className="fs-label mt-8 block text-[var(--fs-muted-on-espresso)]"
        >
          {COPY.admin.passphraseLabel}
        </label>
        <input
          id="fs-admin-passphrase"
          name="passphrase"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error !== null}
          aria-describedby={error ? "fs-admin-error" : undefined}
          className="mt-2 w-full rounded-[var(--fs-radius)] border border-[var(--fs-line)] bg-[var(--fs-ink)] px-4 py-3 text-[var(--fs-cream)]"
        />

        {error ? <ErrorNote id="fs-admin-error">{error}</ErrorNote> : null}

        <button
          type="submit"
          disabled={busy}
          className="fs-label mt-6 h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)] disabled:opacity-70"
        >
          {COPY.admin.unlock}
        </button>
      </form>
      <div />
    </main>
  );
}
