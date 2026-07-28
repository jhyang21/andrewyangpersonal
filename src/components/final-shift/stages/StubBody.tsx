/**
 * Placeholder body for a stage whose controls aren't built yet.
 *
 * Phase 1 exists to prove the machine: stage state, history, focus, and the frame. Each stage below
 * already carries its real heading, support line, and button copy, so the later phases fill in a body
 * rather than rebuilding a screen. This component disappears as they do.
 */
export function StubBody({ note }: { note: string }) {
  return (
    <div className="rounded-[var(--fs-radius)] border border-dashed border-[var(--fs-line)] p-5">
      <p className="fs-label text-[var(--fs-muted-on-espresso)]">Not built yet</p>
      <p className="fs-body mt-2 text-[var(--fs-oat)]">{note}</p>
    </div>
  );
}
