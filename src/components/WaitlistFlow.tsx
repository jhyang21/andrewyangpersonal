"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  commitmentOptions,
  emotionalHookOptions,
  featureSignalOptions,
  identityOptions,
} from "@/lib/waitlistOptions";

type WaitlistFlowProps = {
  compact?: boolean;
};

type SubmitState = "idle" | "submitting" | "success" | "error";
type SuccessCode = "created" | "updated";

const TOTAL_STEPS = 6;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function WaitlistFlow({ compact = false }: WaitlistFlowProps) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [identity, setIdentity] = useState("");
  const [emotionalHook, setEmotionalHook] = useState("");
  const [goldInsight, setGoldInsight] = useState("");
  const [featureSignals, setFeatureSignals] = useState<string[]>([]);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [successCode, setSuccessCode] = useState<SuccessCode>("created");
  const [errorMessage, setErrorMessage] = useState("");
  const [company, setCompany] = useState("");

  const progress = useMemo(() => {
    if (submitState === "success") {
      return 100;
    }
    return Math.round((step / TOTAL_STEPS) * 100);
  }, [step, submitState]);

  async function submitWaitlist(selectedCommitment: string) {
    setSubmitState("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          identity,
          emotionalHook,
          goldInsight,
          featureSignal: featureSignals,
          commitment: selectedCommitment,
          company,
        }),
      });

      let payloadMessage: string | undefined;
      let payloadCode: SuccessCode | undefined;
      const contentType = response.headers.get("content-type") ?? "";
      try {
        if (contentType.includes("application/json")) {
          const payload = (await response.json()) as { message?: string; code?: string };
          payloadMessage = payload.message;
          if (payload.code === "created" || payload.code === "updated") {
            payloadCode = payload.code;
          }
        } else {
          payloadMessage = (await response.text()).trim() || undefined;
        }
      } catch {
        payloadMessage = undefined;
      }

      if (!response.ok) {
        throw new Error(payloadMessage ?? "Could not submit your waitlist request.");
      }

      setSuccessCode(payloadCode ?? "created");
      setSubmitState("success");
    } catch (error) {
      setSubmitState("error");
      setErrorMessage(error instanceof Error ? error.message : "Submission failed.");
    }
  }

  function handleEmailContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setErrorMessage("Please provide a valid email address.");
      return;
    }
    setErrorMessage("");
    setStep(2);
  }

  function handleGoldInsightContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goldInsight.trim()) {
      setErrorMessage("Please share one detail you forgot recently.");
      return;
    }
    setErrorMessage("");
    setStep(5);
  }

  function toggleFeatureSignal(option: string) {
    setErrorMessage("");
    setFeatureSignals((previous) => {
      if (previous.includes(option)) {
        return previous.filter((item) => item !== option);
      }
      if (previous.length >= 2) {
        return previous;
      }
      return [...previous, option];
    });
  }

  async function handleCommitmentSelect(option: string) {
    if (submitState === "submitting") {
      return;
    }
    await submitWaitlist(option);
  }

  if (submitState === "success") {
    return (
      <div className="paper-card card-fold max-w-2xl p-6">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-secondary)]">saved note</p>
        <h3 className="mt-2 font-serif text-2xl text-[var(--color-ink)]">
          {successCode === "updated" ? "You are already on the list." : "You are on the list."}
        </h3>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {successCode === "updated"
            ? "We found your existing signup and updated your responses."
            : "Thanks for sharing this with us. Your answers help shape Relora."}
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
    <div className="paper-card max-w-2xl p-4 md:p-5">
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-[var(--color-secondary)]">
          <span>
            Step {Math.min(step, TOTAL_STEPS)} of {TOTAL_STEPS}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border-warm)]/60">
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        value={company}
        onChange={(event) => setCompany(event.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      {step === 1 ? (
        <form onSubmit={handleEmailContinue} className="space-y-3">
          <p className="text-sm uppercase tracking-[0.12em] text-[var(--color-secondary)]">Frictionless entry</p>
          <h3 className="font-serif text-2xl text-[var(--color-ink)]">Enter your email to get early access.</h3>
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
              className="rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-paper)] transition hover:bg-[var(--color-primary-hover)]"
            >
              Continue
            </button>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <section>
          <p className="text-sm uppercase tracking-[0.12em] text-[var(--color-secondary)]">Identity</p>
          <h3 className="mt-1 font-serif text-2xl text-[var(--color-ink)]">What best describes you?</h3>
          <div className="mt-4 grid gap-3">
            {identityOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setIdentity(option);
                  setStep(3);
                }}
                className="rounded-2xl border border-[var(--color-border-warm)] bg-[var(--color-paper)] px-4 py-4 text-left text-sm font-medium text-[var(--color-ink)] transition hover:-translate-y-0.5 hover:border-[var(--color-secondary)]"
              >
                {option}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section>
          <p className="text-sm uppercase tracking-[0.12em] text-[var(--color-secondary)]">Emotional hook</p>
          <h3 className="mt-1 font-serif text-2xl text-[var(--color-ink)]">
            Be honest - how often do you forget small details about people?
          </h3>
          <div className="mt-4 grid gap-3">
            {emotionalHookOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setEmotionalHook(option);
                  setStep(4);
                }}
                className="rounded-2xl border border-[var(--color-border-warm)] bg-[var(--color-paper)] px-4 py-4 text-left text-sm font-medium text-[var(--color-ink)] transition hover:-translate-y-0.5 hover:border-[var(--color-secondary)]"
              >
                {option}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <form onSubmit={handleGoldInsightContinue} className="space-y-3">
          <p className="text-sm uppercase tracking-[0.12em] text-[var(--color-secondary)]">Gold insight</p>
          <h3 className="font-serif text-2xl text-[var(--color-ink)]">
            What&apos;s one detail you forgot recently that you wish you had remembered?
          </h3>
          <textarea
            name="goldInsight"
            rows={compact ? 3 : 4}
            value={goldInsight}
            onChange={(event) => setGoldInsight(event.target.value)}
            placeholder="Example: I forgot their daughter's name before our call."
            className="w-full rounded-2xl border border-[var(--color-border-warm)] bg-[var(--color-paper)] px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)]"
          />
          <button
            type="submit"
            className="rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-paper)] transition hover:bg-[var(--color-primary-hover)]"
          >
            Continue
          </button>
        </form>
      ) : null}

      {step === 5 ? (
        <section>
          <p className="text-sm uppercase tracking-[0.12em] text-[var(--color-secondary)]">Feature signal</p>
          <h3 className="mt-1 font-serif text-2xl text-[var(--color-ink)]">
            What would make this indispensable for you? (Pick up to 2)
          </h3>
          <div className="mt-4 grid gap-3">
            {featureSignalOptions.map((option) => {
              const selected = featureSignals.includes(option);
              const disableOption = !selected && featureSignals.length >= 2;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleFeatureSignal(option)}
                  disabled={disableOption}
                  className={`rounded-2xl border px-4 py-4 text-left text-sm font-medium transition ${
                    selected
                      ? "border-[var(--color-secondary)] bg-[var(--color-secondary)]/10 text-[var(--color-ink)]"
                      : "border-[var(--color-border-warm)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:-translate-y-0.5 hover:border-[var(--color-secondary)]"
                  } ${disableOption ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-[var(--color-muted)]">{featureSignals.length}/2 selected</p>
            <button
              type="button"
              onClick={() => setStep(6)}
              disabled={featureSignals.length === 0}
              className="rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-paper)] transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-80"
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 6 ? (
        <section>
          <p className="text-sm uppercase tracking-[0.12em] text-[var(--color-secondary)]">Commitment</p>
          <h3 className="mt-1 font-serif text-2xl text-[var(--color-ink)]">Want early beta access?</h3>
          <div className="mt-4 grid gap-3">
            {commitmentOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleCommitmentSelect(option)}
                disabled={submitState === "submitting"}
                className="rounded-2xl border border-[var(--color-border-warm)] bg-[var(--color-paper)] px-4 py-4 text-left text-sm font-medium text-[var(--color-ink)] transition hover:-translate-y-0.5 hover:border-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-75"
              >
                {option}
              </button>
            ))}
          </div>
          {submitState === "submitting" ? <p className="mt-3 text-sm text-[var(--color-muted)]">Saving...</p> : null}
        </section>
      ) : null}

      {submitState === "error" ? (
        <p className="mt-3 text-sm text-[var(--color-primary-hover)]" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
