"use client";

import { ArrowUp, CircleExclamationPoint, LoaderCircle } from "lucide-react";
import { useCallback, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from "react";
import { cn } from "./cn";

export interface IntentInputProps {
  /**
   * Called with the trimmed text. The field clears after it returns, unless
   * it returns `false`, which keeps the text (say, a send that failed). A
   * promise works too: the field clears when it settles to anything but
   * `false`, and only if the buyer has not typed something new meanwhile.
   * A promise that rejects keeps the text. Until it settles, further sends
   * are ignored; typing still works.
   */
  onSubmit: (text: string) => SubmitResult | Promise<SubmitResult>;
  /** The input's label, read by screen readers. Default "Tell Pica what you're trying to do". */
  label?: string;
  placeholder?: string;
  /** Starting text when the field manages its own value. */
  defaultValue?: string;
  /**
   * Pass to control the text from outside, for example when an example chip
   * fills the box. Pair it with `onValueChange`.
   */
  value?: string;
  /** Every change to the text, typed or cleared after a send. */
  onValueChange?: (text: string) => void;
  /** Label for the round submit button. Default "Ask Pica". */
  submitLabel?: string;
  /**
   * A reply is on its way: the button spins and Enter does nothing until the
   * reply ends (nothing is queued). Typing still works, so the buyer can
   * draft the next message.
   */
  busy?: boolean;
  /** Read out by screen readers while busy. Default "Pica is replying". */
  busyLabel?: string;
  /** Turns the whole input off, for example when a conversation is full. */
  disabled?: boolean;
  /** A field error under the input, such as "message too long". The text stays. */
  error?: string;
  /** Give up focus after a send, so a phone's keyboard closes. */
  blurOnSubmit?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  /** The text field itself, for a screen that moves focus into it. */
  inputRef?: Ref<HTMLTextAreaElement>;
  className?: string;
}

/** `false` keeps the text in the field; anything else clears it. */
export type SubmitResult = void | boolean;

/**
 * Whether the field should clear after a send. Pure, so the rule is tested
 * without a DOM: only `false` keeps the text.
 */
export function shouldClear(result: unknown): boolean {
  return result !== false;
}

function isPromise(value: unknown): value is Promise<unknown> {
  return typeof (value as Promise<unknown> | null)?.then === "function";
}

/**
 * What happens after `onSubmit` returns. `clear` runs at once for a plain
 * result, or when a promise settles, and then only if the field still holds
 * the text that was sent (`current` reads it). Returns the promise, if any,
 * so a test can wait on it.
 */
export function afterSend(
  result: SubmitResult | Promise<SubmitResult>,
  sent: string,
  current: () => string,
  clear: () => void,
): Promise<void> | undefined {
  if (!isPromise(result)) {
    if (shouldClear(result)) clear();
    return undefined;
  }
  return result.then(
    (settled) => {
      if (shouldClear(settled) && current().trim() === sent) clear();
    },
    () => undefined,
  );
}

/**
 * Lets one send through at a time. While the promise from an earlier send
 * is unsettled, `pending.current` is true and a new send is ignored (returns
 * false), so a second Enter cannot send the same message again. A plain
 * result never holds the gate. `onChange` hears the gate open and close, so
 * the button can show it. A ref, not state, so two Enters in one tick both
 * see the first.
 */
export function sendOnce(
  pending: { current: boolean },
  submit: () => SubmitResult | Promise<SubmitResult>,
  settle: (result: SubmitResult | Promise<SubmitResult>) => Promise<void> | undefined,
  onChange?: (pending: boolean) => void,
): boolean {
  if (pending.current) return false;
  const done = settle(submit());
  if (done) {
    pending.current = true;
    onChange?.(true);
    const release = () => {
      pending.current = false;
      onChange?.(false);
    };
    done.then(release, release);
  }
  return true;
}

const MAX_HEIGHT = 200;

/** Points the field's own ref and the caller's `inputRef` (an object or a function) at one element. */
export function setBoth<T>(own: { current: T | null }, theirs: Ref<T> | undefined, el: T | null): void {
  own.current = el;
  if (typeof theirs === "function") theirs(el);
  else if (theirs) theirs.current = el;
}

/**
 * The inline height for the text box. Empty, it takes none, so `rows={1}`
 * holds it to one line: Chrome counts a wrapped placeholder in
 * `scrollHeight`, which would make an empty box several lines tall. With
 * text, it fits the text up to the cap, then scrolls.
 */
export function fitHeight(text: string, scrollHeight: number): string {
  return text.length === 0 ? "" : `${Math.min(scrollHeight, MAX_HEIGHT)}px`;
}

/** The keydown fields that decide whether Enter sends. */
export interface SendKeyEvent {
  key: string;
  shiftKey: boolean;
  /** True while an input method (Japanese, Chinese, Korean) is composing. */
  isComposing: boolean;
  /** 229 is the keyCode some browsers (Safari) send for the Enter that ends composing. */
  keyCode?: number;
}

/** Enter sends; Shift+Enter adds a line; Enter that confirms an IME word does neither. */
export function isSendKey(e: SendKeyEvent): boolean {
  return e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229;
}

/**
 * The big input on Home, and the composer in chat. White, radius 28, grows
 * with long text. Enter sends; Shift+Enter adds a line.
 */
export function IntentInput({
  onSubmit,
  label = "Tell Pica what you're trying to do",
  placeholder = "A week away with one bag, a lighter commute",
  defaultValue = "",
  value,
  onValueChange,
  submitLabel = "Ask Pica",
  busy = false,
  busyLabel = "Pica is replying",
  disabled = false,
  error,
  blurOnSubmit = false,
  maxLength = 500,
  autoFocus,
  inputRef,
  className,
}: IntentInputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const ref = useRef<HTMLTextAreaElement>(null);
  // Our own ref and the caller's, on one element.
  const setRefs = useCallback((el: HTMLTextAreaElement | null) => setBoth(ref, inputRef, el), [inputRef]);
  const [ownText, setOwnText] = useState(defaultValue);
  const text = value ?? ownText;
  const empty = text.trim().length === 0;
  const blocked = disabled || busy;

  function setText(next: string) {
    if (value === undefined) setOwnText(next);
    onValueChange?.(next);
  }

  // Grow the box to fit its text, up to a limit, then scroll. Empty, it is
  // one line tall, however long the placeholder.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = fitHeight(text, el.scrollHeight);
  }, [text]);

  // The text as of the last render, for a send that settles later.
  const latest = useRef(text);
  useLayoutEffect(() => {
    latest.current = text;
  });

  function clear() {
    setText("");
    if (blurOnSubmit) ref.current?.blur();
  }

  // A send whose promise has not settled. The ref blocks a second send at
  // once; the state greys the button. Typing still works.
  const pending = useRef(false);
  const [waiting, setWaiting] = useState(false);

  function send() {
    const trimmed = text.trim();
    if (!trimmed || blocked) return;
    // A send that settles later keeps anything typed since.
    sendOnce(
      pending,
      () => onSubmit(trimmed),
      (result) => afterSend(result, trimmed, () => latest.current, clear),
      setWaiting,
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      isSendKey({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing, keyCode: e.keyCode })
    ) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <form
        onSubmit={handleSubmit}
        className={cn(
          "flex w-full items-end gap-2 rounded-card border p-1.5 pl-5 shadow-float",
          "transition-colors duration-(--duration-fast) ease-out-soft",
          disabled ? "border-hairline bg-canvas" : cn("bg-surface", error ? "border-critical" : "border-ink-muted"),
          // The brief's focus ring, 2px purple with a 2px gap, drawn round the
          // whole box while the text field has focus. The send button draws
          // its own ring, so this one keys on the textarea only. The colour
          // is set at rest so `transition-colors` does not fade it from ink.
          "outline-shop-purple has-[textarea:focus]:outline-2 has-[textarea:focus]:outline-offset-2",
        )}
      >
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <textarea
          id={id}
          ref={setRefs}
          rows={1}
          value={text}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          enterKeyHint="send"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          // The form draws the focus ring (see above). `outline-hidden` beats
          // the global :focus-visible rule, which sits in `@layer base`.
          className="min-h-11 min-w-0 flex-1 resize-none self-center bg-transparent py-2.5 text-body-lg text-ink outline-hidden placeholder:text-ink-soft disabled:cursor-not-allowed disabled:text-ink-muted"
        />
        <button
          type="submit"
          aria-label={submitLabel}
          disabled={blocked || empty || waiting}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full",
            "transition-colors duration-(--duration-fast) ease-out-soft",
            blocked || empty || waiting
              ? "cursor-not-allowed bg-hairline text-ink-muted"
              : "bg-shop-purple text-surface hover:bg-shop-purple-pressed",
          )}
        >
          {busy ? (
            <LoaderCircle aria-hidden size={20} className="motion-safe:animate-spin" />
          ) : (
            <ArrowUp aria-hidden size={20} />
          )}
        </button>
        {/* The button is disabled while busy, so a keyboard user in the text box
            never reaches its name. This polite line tells them instead. */}
        <span role="status" className="sr-only">
          {busy ? busyLabel : ""}
        </span>
      </form>
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 px-5 text-caption text-ink">
          <CircleExclamationPoint aria-hidden size={16} className="shrink-0 text-critical" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
