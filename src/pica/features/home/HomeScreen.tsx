"use client";

import { BASE } from "@/pica/lib/base";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { Button, Card, Chip, IntentInput, Skeleton } from "@/pica/components/kit";
import { Pica } from "@/pica/components/mascot";
import { useSessionStore } from "@/pica/lib/session";
import { StorageNotice } from "@/pica/features/parts";
import { useStartDecision } from "@/pica/features/shared/useStartDecision";
import { CATEGORY_LINKS, EXAMPLES, HOME, chipTap, homePose, resumeCard, sendGate, type ResumeCard } from "./home-model";
import { SetupCard } from "./SetupCard";
import { SETUP } from "./setup-model";
import { useSetup } from "./useSetup";

export interface HomeViewProps {
  text: string;
  onTextChange: (text: string) => void;
  /** Return a promise to hold the send button until it settles. */
  onSend: (text: string) => void | Promise<void>;
  /** An example chip was tapped: fill the box with its words. */
  onExample: (text: string) => void;
  /** A decision is opening; the box and the chips wait. */
  busy: boolean;
  resume: ResumeCard | null;
  /** Shown under the header when the browser will not save. */
  notice?: ReactNode;
  /** The goal box's text field, so the screen can move focus into it. */
  inputRef?: Ref<HTMLTextAreaElement>;
  /** Shown in place of the goal box and chips: the first-run choice, or its placeholder while Home asks the server. */
  setup?: ReactNode;
  /** A quiet line at the foot, such as "Change setup". */
  footer?: ReactNode;
}

/** Home with no store and no router, for tests. */
export function HomeView({
  text,
  onTextChange,
  onSend,
  onExample,
  busy,
  resume,
  notice,
  inputRef,
  setup,
  footer,
}: HomeViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-6 pb-16 sm:pt-12">
      {notice}
      <div className="flex flex-col items-center gap-3 text-center">
        <Pica pose={homePose(text)} size={120} />
        <h1 className="text-display font-semibold text-ink">{HOME.heading}</h1>
      </div>

      {setup ?? (
        <div className="flex flex-col gap-3">
          <IntentInput
            label={HOME.boxLabel}
            placeholder={HOME.placeholder}
            value={text}
            onValueChange={onTextChange}
            onSubmit={onSend}
            busy={busy}
            busyLabel={HOME.starting}
            inputRef={inputRef}
          />
          <ul aria-label={HOME.examples} className="flex flex-wrap justify-center gap-x-2 gap-y-4">
            {EXAMPLES.map((example) => (
              <li key={example.text} className="max-w-full">
                <Chip label={example.text} disabled={busy} onClick={() => onExample(example.text)} />
              </li>
            ))}
          </ul>
          <p className="text-center text-body text-ink-soft">{HOME.scope}</p>
        </div>
      )}

      {/* Below the box: the store loads after the first paint, and a card
          arriving above would push the box and chips down under a tap. */}
      {resume ? <ResumeCardView card={resume} /> : null}

      <nav aria-labelledby="home-browse" className="flex flex-col items-center gap-3">
        <p id="home-browse" className="text-body text-ink-soft">
          {HOME.browse}
        </p>
        <ul className="flex flex-wrap justify-center gap-2">
          {CATEGORY_LINKS.map((link) => (
            <li key={link.category}>
              <Button on="canvas" href={`${BASE}/browse?category=${link.category}`}>
                {link.label}
              </Button>
            </li>
          ))}
        </ul>
      </nav>
      {footer}
    </main>
  );
}

function ResumeCardView({ card }: { card: ResumeCard }) {
  return (
    <Card as="section" padding="md" className="flex flex-col gap-3">
      <h2 className="text-body font-semibold text-ink">{HOME.resumeHeading}</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-body-lg font-semibold break-words text-ink">{card.title}</p>
          <p className="text-body text-ink-muted">{card.facts}</p>
        </div>
        <Button href={card.href} className="shrink-0">
          {HOME.resume}
          <span className="sr-only">: {card.title}</span>
        </Button>
      </div>
      {card.others > 0 ? (
        <Link
          href={`${BASE}/saved`}
          className="inline-flex min-h-11 items-center self-start text-body text-ink underline underline-offset-4"
        >
          {HOME.allSaved}
        </Link>
      ) : null}
    </Card>
  );
}

/** Focus the text field, with the caret after its text. */
function focusEnd(field: HTMLTextAreaElement | null) {
  if (!field) return;
  field.focus();
  field.setSelectionRange(field.value.length, field.value.length);
}

/** Brief 6.1: describe life once you have the right bag, in your own words, or pick up an open decision. */
export function HomeScreen() {
  // Busy until the page hides, so Back shows the box ready for another question.
  const { busy, start } = useStartDecision();
  const { sessions } = useSessionStore();
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const focusBox = useRef(false);
  const [gate] = useState(sendGate);
  const setup = useSetup();

  // A send holds the box's gate until the hook frees `busy` or the page
  // hides (Next keeps it, hidden, for Back).
  useEffect(() => gate.busyChanged(busy), [gate, busy]);
  useEffect(() => gate.hide, [gate]);

  // After a chip fills the box, move focus into it with the caret at the
  // end, so the buyer can edit or send and a screen reader reads the words
  // once, as the field's value. No live region repeats them.
  useEffect(() => {
    if (!focusBox.current) return;
    focusBox.current = false;
    focusEnd(field.current);
  }, [text]);

  return (
    <HomeView
      text={text}
      onTextChange={setText}
      onSend={(sent) => gate.send(sent, start)}
      onExample={(example) => {
        const tap = chipTap(text, example);
        // Nothing to fill, so no render to wait for: focus now.
        if (tap.kind === "focus") return focusEnd(field.current);
        focusBox.current = true;
        setText(tap.text);
      }}
      busy={busy}
      resume={resumeCard(sessions)}
      notice={<StorageNotice />}
      inputRef={field}
      setup={
        setup.status === "checking" ? (
          <Skeleton className="h-56" />
        ) : setup.showChoice ? (
          <SetupCard
            onKey={setup.saveKey}
            onDemo={setup.demo}
            hasKey={setup.hasKey}
            onForget={setup.hasKey ? setup.forgetKey : undefined}
            onKeep={setup.keep}
          />
        ) : undefined
      }
      footer={
        setup.canChange ? (
          <button
            type="button"
            onClick={setup.change}
            className="inline-flex min-h-11 items-center self-center text-body text-ink-soft underline underline-offset-4 hover:text-ink"
          >
            {SETUP.change}
          </button>
        ) : null
      }
    />
  );
}
