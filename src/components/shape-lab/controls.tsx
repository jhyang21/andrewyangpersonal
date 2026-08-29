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

type InfoProps = {
  /** Names the button ("About Bulge"); the description itself is the button's accessible hint. */
  label: string;
  description: string;
};

/**
 * The one hover-description control. It is a button rather than a bare span so a touch or a Tab
 * can open the tip too, and the tip is plain hidden markup — the server and the client render the
 * same thing, and nothing measures or positions it at runtime.
 */
export function Info({ label, description }: InfoProps) {
  const id = useId();
  return (
    <button type="button" className="sl-info" aria-label={`About ${label}`} aria-describedby={id}>
      i
      <span id={id} role="tooltip" className="sl-tip">
        {description}
      </span>
    </button>
  );
}

type SliderProps = {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

export function Slider({ label, description, value, min, max, step, onChange }: SliderProps) {
  const id = useId();
  return (
    <div className="sl-control">
      {/*
        The head is a div, not the label: a button inside a label is activated by every tap on that
        label, so opening the tip would also grab the slider.
      */}
      <div className="sl-control-head">
        <label className="sl-control-head-text" htmlFor={id}>
          <span className="sl-control-label">{label}</span>
          <span className="sl-readout">{value.toFixed(decimalsFor(step))}</span>
        </label>
        <Info label={label} description={description} />
      </div>
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
  description: string;
  value: T;
  options: readonly T[];
  /** Override for an option whose display text `humanize` can't derive (accents, extra words). */
  optionLabels?: Partial<Record<T, string>>;
  onChange: (value: T) => void;
};

export function Select<T extends string>({
  label,
  description,
  value,
  options,
  optionLabels,
  onChange,
}: SelectProps<T>) {
  const id = useId();
  return (
    <div className="sl-control">
      <div className="sl-control-head">
        <label className="sl-control-head-text" htmlFor={id}>
          <span className="sl-control-label">{label}</span>
        </label>
        <Info label={label} description={description} />
      </div>
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
