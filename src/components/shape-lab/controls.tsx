import { useId } from "react";

/** "switchProbability" → "Switch probability". Enum option values are the only labels we don't author. */
export function humanize(value: string): string {
  const spaced = value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** Decimals implied by the step, so a 0.01 slider never reads "0.30000000000000004". */
function decimalsFor(step: number): number {
  if (step >= 1) return 0;
  const fraction = String(step).split(".")[1];
  return fraction ? Math.min(3, fraction.length) : 2;
}

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

export function Slider({ label, value, min, max, step, onChange }: SliderProps) {
  const id = useId();
  return (
    <div className="sl-control">
      <label className="sl-control-head" htmlFor={id}>
        <span className="sl-control-label">{label}</span>
        <span className="sl-readout">{value.toFixed(decimalsFor(step))}</span>
      </label>
      <input
        id={id}
        className="sl-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </div>
  );
}

type SelectProps<T extends string> = {
  label: string;
  value: T;
  options: readonly T[];
  /** Override for an option whose display text `humanize` can't derive (accents, extra words). */
  optionLabels?: Partial<Record<T, string>>;
  onChange: (value: T) => void;
};

export function Select<T extends string>({
  label,
  value,
  options,
  optionLabels,
  onChange,
}: SelectProps<T>) {
  const id = useId();
  return (
    <div className="sl-control">
      <label className="sl-control-head" htmlFor={id}>
        <span className="sl-control-label">{label}</span>
      </label>
      <select
        id={id}
        className="sl-select"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? humanize(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function Toggle({ label, checked, onChange, disabled = false }: ToggleProps) {
  return (
    <label className={`sl-toggle${disabled ? " is-disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

type SeedFieldProps = {
  text: string;
  onTextChange: (text: string) => void;
  onCommit: () => void;
};

/**
 * The text is committed on blur and on Enter rather than on every keystroke — a seed is typed
 * whole, and regenerating on each intermediate digit would burn a shape per character.
 */
export function SeedField({ text, onTextChange, onCommit }: SeedFieldProps) {
  return (
    <input
      className="sl-seed-input sl-readout"
      type="text"
      value={text}
      aria-label="Seed"
      spellCheck={false}
      autoComplete="off"
      onChange={(event) => onTextChange(event.currentTarget.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit();
        }
      }}
    />
  );
}
