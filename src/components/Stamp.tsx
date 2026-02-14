type StampProps = {
  label: string;
  rotate?: "-2" | "-1" | "0" | "1" | "2";
};

const rotateClassMap: Record<NonNullable<StampProps["rotate"]>, string> = {
  "-2": "-rotate-2",
  "-1": "-rotate-1",
  "0": "rotate-0",
  "1": "rotate-1",
  "2": "rotate-2",
};

export function Stamp({ label, rotate = "0" }: StampProps) {
  return (
    <span
      className={`inline-block rounded-full border border-[var(--color-border-warm)] bg-[var(--color-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)] ${rotateClassMap[rotate]}`}
    >
      {label}
    </span>
  );
}
