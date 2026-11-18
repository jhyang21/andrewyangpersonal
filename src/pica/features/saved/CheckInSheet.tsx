"use client";

import { Button, Chip, Sheet, TextArea } from "@/pica/components/kit";
import type { DecisionSession } from "@/pica/lib/types";
import { CHECK_IN, MET_CHOICES, SATISFIED_CHOICES, checkInDescription } from "./checkin-model";
import { useCheckIn } from "./useCheckIn";

interface CheckInSheetProps {
  session: DecisionSession | null;
  onClose: () => void;
  /** The sheet's id, for `aria-controls` on the Check in buttons. */
  id?: string;
  /** Runs when Save stores the check-in, just before the sheet closes. */
  onSaved?: () => void;
}

/** Brief 6.8: after a purchase, each stated must-have, then overall, then a note. */
export function CheckInSheet({ session, onClose, id, onSaved }: CheckInSheetProps) {
  return (
    <Sheet
      id={id}
      open={session !== null}
      onClose={onClose}
      title={CHECK_IN.title}
      description={session ? checkInDescription(session) : undefined}
    >
      {session ? (
        <CheckInForm
          key={session.id}
          session={session}
          onDone={() => {
            onSaved?.();
            onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}

function CheckInForm({ session, onDone }: { session: DecisionSession; onDone: () => void }) {
  const form = useCheckIn(session, onDone);
  return (
    <CheckInFormView
      items={form.items}
      isMet={form.isMet}
      onAnswer={form.answer}
      satisfied={form.satisfied}
      onOverall={form.pickOverall}
      missingOverall={form.missingOverall}
      note={form.note}
      onNote={form.setNote}
      onSave={form.save}
    />
  );
}

type Form = ReturnType<typeof useCheckIn>;

export interface CheckInFormViewProps {
  items: Form["items"];
  isMet: Form["isMet"];
  onAnswer: Form["answer"];
  satisfied: Form["satisfied"];
  onOverall: Form["pickOverall"];
  missingOverall: boolean;
  note: string;
  onNote: (note: string) => void;
  onSave: () => void;
}

/** The form with no store, for tests. */
export function CheckInFormView(props: CheckInFormViewProps) {
  const { items, isMet, satisfied, missingOverall, note } = props;
  return (
    <div className="flex flex-col gap-5">
      {items.length > 0 ? (
        <section aria-labelledby="checkin-needs" className="flex flex-col gap-3">
          <h3 id="checkin-needs" className="text-body-lg font-semibold text-ink">
            {CHECK_IN.needsHeading}
          </h3>
          <ul className="flex flex-col gap-4">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2">
                <p id={`met-${item.id}`} className="text-body break-words text-ink">
                  {item.text}
                </p>
                <div role="group" aria-labelledby={`met-${item.id}`} className="flex flex-wrap gap-x-2 gap-y-4">
                  {MET_CHOICES.map((choice) => (
                    <Chip
                      key={choice.label}
                      label={choice.label}
                      selected={isMet(item.id, choice.value)}
                      onClick={() => props.onAnswer(item.id, choice.value)}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="checkin-overall" className="flex flex-col gap-2">
        <h3 id="checkin-overall" className="text-body-lg font-semibold text-ink">
          {CHECK_IN.overallHeading}
        </h3>
        <div role="group" aria-labelledby="checkin-overall" className="flex flex-wrap gap-x-2 gap-y-4">
          {SATISFIED_CHOICES.map((choice) => (
            <Chip
              key={choice.value}
              label={choice.label}
              selected={satisfied === choice.value}
              onClick={() => props.onOverall(choice.value)}
            />
          ))}
        </div>
        {missingOverall ? (
          <p role="alert" className="text-body text-critical">
            {CHECK_IN.missingOverall}
          </p>
        ) : null}
      </section>

      <TextArea
        label={CHECK_IN.noteLabel}
        hint={CHECK_IN.noteHint}
        value={note}
        maxLength={500}
        onChange={(e) => props.onNote(e.target.value)}
      />

      <Button variant="primary" fullWidth onClick={props.onSave}>
        {CHECK_IN.save}
      </Button>
    </div>
  );
}
