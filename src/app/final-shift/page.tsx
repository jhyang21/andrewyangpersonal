/*
 * Phase 0 scaffold. This renders a static approximation of the clock-in stage purely so the fonts,
 * palette, safe-area handling, and stage grid can be verified on a real phone. Phase 1 replaces the
 * body of this file with <ShiftMachine>.
 */

// Nothing here is cacheable: every render depends on the guest's session cookie.
export const dynamic = "force-dynamic";

export default function FinalShiftPage() {
  return (
    <main className="fs-stage">
      <header className="flex items-center justify-between">
        <span className="fs-label text-[var(--fs-oat)]">Andrew&apos;s Final Shift</span>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col justify-center">
        <p className="fs-label text-[var(--fs-steel)]">Timeclock / 01</p>
        <h1 className="fs-display mt-3 text-[var(--fs-cream)]">
          Clock in for one last round.
        </h1>
        <p className="fs-body mt-4 text-[var(--fs-oat)]">
          Enter your own 4-digit employee number, the one you use to clock in.
        </p>

        <div className="mt-8 flex gap-3" aria-hidden="true">
          {["0", "4", "2", "7"].map((digit, i) => (
            <span
              key={i}
              className="fs-digit flex h-16 flex-1 items-center justify-center rounded-[var(--fs-radius)] border border-[var(--fs-line)] bg-[var(--fs-cream)] text-[var(--fs-ink)]"
            >
              {digit}
            </span>
          ))}
        </div>

        <p className="fs-meta mt-6 text-[var(--fs-steel-text)]">
          Scaffold only — the keypad, stage machine, and roster arrive in later phases.
        </p>
      </div>

      <div className="mx-auto w-full max-w-md">
        <button
          type="button"
          disabled
          className="fs-label h-14 w-full rounded-[var(--fs-radius)] bg-[var(--fs-red)] text-[var(--fs-cream)] disabled:opacity-60"
        >
          Clock in
        </button>
      </div>
    </main>
  );
}
