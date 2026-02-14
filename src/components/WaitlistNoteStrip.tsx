"use client";

import { FormEvent, useState } from "react";

type WaitlistNoteStripProps = {
  compact?: boolean;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

export function WaitlistNoteStrip({ compact = false }: WaitlistNoteStripProps) {
  const [email, setEmail] = useState("");
  const [intent, setIntent] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("submitting");
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);
    const company = String(formData.get("company") ?? "");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          intent,
          company,
        }),
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Could not submit your waitlist request.");
      }

      setSubmitState("success");
      setEmail("");
      setIntent("");
      event.currentTarget.reset();
    } catch (error) {
      setSubmitState("error");
      setErrorMessage(error instanceof Error ? error.message : "Submission failed.");
    }
  }

  if (submitState === "success") {
    return (
      <div className="paper-card card-fold max-w-2xl p-6">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-secondary)]">saved note</p>
        <h3 className="mt-2 font-serif text-2xl text-[var(--color-ink)]">You are on the list.</h3>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Thanks for the interest in Relora. Early users shape the product.
        </p>
        <a
          href="https://x.com/intent/post?text=I%20just%20joined%20the%20Relora%20waitlist%20for%20better%20relationship%20memory."
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm font-semibold text-[var(--color-secondary)] underline-offset-4 hover:underline"
        >
          Share with a friend
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="paper-card max-w-2xl p-4 md:p-5">
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          type="email"
          required
          name="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-full border border-[var(--color-border-warm)] bg-[var(--color-paper)] px-4 py-3 text-[var(--color-ink)] placeholder:text-[var(--color-muted)]"
        />
        <button
          type="submit"
          disabled={submitState === "submitting"}
          className="rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-paper)] transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-80"
        >
          {submitState === "submitting" ? "Joining..." : "Join waitlist"}
        </button>
      </div>
      <textarea
        name="intent"
        rows={compact ? 2 : 3}
        value={intent}
        onChange={(event) => setIntent(event.target.value)}
        placeholder="Optional: What do you want Relora to help you remember?"
        className="mt-3 w-full rounded-2xl border border-[var(--color-border-warm)] bg-[var(--color-paper)] px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)]"
      />
      <p className="mt-2 text-xs text-[var(--color-muted)]">No spam. Early users shape the product.</p>
      {submitState === "error" ? (
        <p className="mt-2 text-sm text-[var(--color-primary-hover)]">{errorMessage}</p>
      ) : null}
    </form>
  );
}
