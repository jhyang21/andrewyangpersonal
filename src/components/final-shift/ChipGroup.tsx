"use client";

type ChipGroupProps = {
  legend: string;
  support?: string;
  options: readonly string[];
  selected: readonly string[];
  onToggle: (option: string) => void;
};

/**
 * Multi-select chips — the dietary tags.
 *
 * A fieldset of real checkboxes rather than a row of buttons with aria-pressed: the group needs a
 * name ("Anything the kitchen should know?"), and a fieldset/legend gives it one that every screen
 * reader already announces correctly.
 *
 * Chips are 44px tall, not the 32 the handoff draws. WCAG 2.2 target size is a floor, and these sit
 * in a dense row where a near miss selects the wrong restriction — a mistake that ends up on a
 * catering order.
 */
export function ChipGroup({ legend, support, options, selected, onToggle }: ChipGroupProps) {
  return (
    <fieldset>
      <legend className="fs-label text-[var(--fs-oat)]">{legend}</legend>
      {support ? (
        <p className="fs-meta mt-1 text-[var(--fs-muted-on-espresso)]">{support}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const isOn = selected.includes(option);
          return (
            <label
              key={option}
              className={`fs-meta flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 transition-colors ${
                isOn
                  ? "border-2 border-[var(--fs-cream)] bg-[var(--fs-cream)] text-[var(--fs-espresso)]"
                  : "border-[var(--fs-line)] text-[var(--fs-cream)] hover:border-[var(--fs-oat)]"
              }`}
            >
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => onToggle(option)}
                className="fs-sr-only"
              />
              <span aria-hidden="true">{isOn ? "✓" : "+"}</span>
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
