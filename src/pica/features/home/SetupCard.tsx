"use client";

import { useId, useState, type ReactNode, type FormEvent } from "react";
import { Button, Card, TextInput, cn } from "@/pica/components/kit";
import { SETUP, keyProblem, type SetupChoice } from "./setup-model";

export interface SetupCardProps {
  /** Sends the key to the local server. Resolves to an error to show, or null once it is kept. */
  onKey: (key: string) => Promise<string | null>;
  /** Starts the demo. */
  onDemo: () => void;
  /** False where the server won't take a key (a hosted copy): only the demo shows. */
  canAdd?: boolean;
  /** A key is already in use: offer to leave things as they are. */
  hasKey?: boolean;
  /** Only for a pasted key; the server can't forget a key from its env. */
  onForget?: () => void;
  onKeep?: () => void;
}

/**
 * Home's first-run choice (brief 6.1). Two options in one form, one Next.
 * The key field is a password field: never shown, never saved by the browser,
 * cleared after each send.
 */
export function SetupCard({ onKey, onDemo, canAdd = true, hasKey = false, onForget, onKeep }: SetupCardProps) {
  const [choice, setChoice] = useState<SetupChoice>(canAdd ? "key" : "demo");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [checking, setChecking] = useState(false);
  const name = useId();
  const headingId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (checking) return;
    if (choice === "demo") return onDemo();
    const problem = keyProblem(key);
    if (problem) return setError(problem);
    setChecking(true);
    setError(undefined);
    const sent = key.trim();
    setKey("");
    const failure = await onKey(sent);
    setChecking(false);
    if (failure) setError(failure);
  }

  return (
    <Card as="section" padding="md" aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-body-lg font-semibold text-ink">
          {SETUP.heading}
        </h2>
        <p className="text-body text-ink-soft">{canAdd ? SETUP.line : SETUP.demoOnlyLine}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">{SETUP.heading}</legend>
          {canAdd ? (
            <Option
              name={name}
              value="key"
              checked={choice === "key"}
              onChoose={setChoice}
              label={SETUP.keyLabel}
              hint={SETUP.keyHint}
            >
              {choice === "key" ? (
                <TextInput
                  label={SETUP.keyField}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="off"
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value);
                    if (error) setError(undefined);
                  }}
                  error={error}
                  disabled={checking}
                />
              ) : null}
            </Option>
          ) : null}
          <Option
            name={name}
            value="demo"
            checked={choice === "demo"}
            onChoose={setChoice}
            label={SETUP.demoLabel}
            hint={SETUP.demoHint}
          />
        </fieldset>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onForget ? (
            <Button variant="ghost" onClick={onForget}>
              {SETUP.forget}
            </Button>
          ) : null}
          {hasKey && onKeep ? <Button onClick={onKeep}>{SETUP.keep}</Button> : null}
          <Button variant="primary" type="submit" loading={checking}>
            {checking ? SETUP.checking : SETUP.next}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Option({
  name,
  value,
  checked,
  onChoose,
  label,
  hint,
  children,
}: {
  name: string;
  value: SetupChoice;
  checked: boolean;
  onChoose: (value: SetupChoice) => void;
  label: string;
  hint: string;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-card border-2 p-4 transition-colors duration-(--duration-fast) ease-out-soft",
        checked ? "border-ink bg-purple-soft" : "border-hairline bg-surface",
      )}
    >
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={() => onChoose(value)}
          aria-describedby={`${id}-hint`}
          className="mt-0.5 size-5 shrink-0 accent-ink"
        />
        <span className="flex flex-col gap-1">
          <span className="text-body font-semibold text-ink">{label}</span>
          <span id={`${id}-hint`} className="text-body text-ink-soft">
            {hint}
          </span>
        </span>
      </label>
      {children}
    </div>
  );
}
