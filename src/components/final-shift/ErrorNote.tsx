/**
 * An inline error, announced.
 *
 * Never colour alone: a glyph and a left rule carry the same message as the red, so it survives
 * greyscale, low vision, and every kind of colour blindness. `role="alert"` makes it announce the
 * moment it appears, which matters because these errors are the answer to a button press the guest
 * expected to move them forward.
 */
export function ErrorNote({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className="fs-body mt-3 flex gap-2 border-l-2 border-[var(--fs-red)] pl-3 text-[var(--fs-oat)]"
    >
      <span aria-hidden="true" className="text-[var(--fs-red)]">
        ✕
      </span>
      <span>{children}</span>
    </p>
  );
}
