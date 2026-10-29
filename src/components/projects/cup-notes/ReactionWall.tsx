"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import { motion } from "motion/react";
import type { CupNotesIndex, Reaction, ScenarioDetail } from "@/lib/cup-notes/types";
import { FaceGlyph } from "./Glyphs";
import { shiftRows } from "./ShiftStrip";
import { ACTION_LABELS, REACTIONS, REACTION_LABELS, T } from "./shared";

type Props = {
  index: CupNotesIndex;
  detail: ScenarioDetail | null;
  t: number;
};

/* Faces are numbered row * 8 + slot, the same order as the shift strip. */
function onFaceKey(e: KeyboardEvent<HTMLButtonElement>, n: number) {
  const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 };
  const d = step[e.key];
  if (d === undefined) return;
  const next = e.currentTarget
    .closest(".cn-wall")
    ?.querySelector<HTMLButtonElement>(`[data-face="${n + d}"]`);
  if (next) {
    e.preventDefault();
    next.focus();
  }
}

export function ReactionWall({ index, detail, t }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const [rove, setRove] = useState(0);
  const rows = shiftRows(index, detail);
  const customers = new Map(index.customers.map((c) => [c.key, c]));

  const counts: Record<Reaction, number> = {
    delighted: 0,
    warm: 0,
    neutral: 0,
    indifferent: 0,
    annoyed: 0,
  };
  rows.forEach(({ shift }, row) =>
    shift?.cups.forEach((cup, slot) => {
      if (t >= T.cup(row, slot) + T.reactionLag) counts[cup.reaction.reaction] += 1;
    }),
  );

  const pickedRow = picked === null ? null : rows[Math.floor(picked / 8)];
  const pickedCup = picked === null ? null : (pickedRow?.shift?.cups[picked % 8] ?? null);
  const pickedVisible =
    pickedCup !== null &&
    picked !== null &&
    t >= T.cup(Math.floor(picked / 8), picked % 8) + T.reactionLag;

  return (
    <div className="cn-wall">
      <ul className="cn-legend" aria-label="Reactions so far">
        {REACTIONS.map((r) => (
          <li key={r}>
            <FaceGlyph reaction={r} />
            <span>{REACTION_LABELS[r]}</span>
            <span className="cn-legend-n">{counts[r]}</span>
          </li>
        ))}
      </ul>

      <div className="cn-wall-grid">
        {index.stores.map((store, si) => (
          <div className="cn-wall-store" key={store.key}>
            <p className="cn-wall-store-name">{store.name}</p>
            {[0, 1].map((bi) => {
              const row = si * 2 + bi;
              const shift = rows[row]?.shift ?? null;
              return (
                <div className="cn-wall-line" key={bi}>
                  {Array.from({ length: 8 }, (_, slot) => {
                    const n = row * 8 + slot;
                    const cup = shift?.cups[slot] ?? null;
                    const shown = cup !== null && t >= T.cup(row, slot) + T.reactionLag;
                    return (
                      <button
                        type="button"
                        key={slot}
                        data-face={n}
                        className={`cn-face-btn ${picked === n ? "cn-face-picked" : ""}`}
                        tabIndex={rove === n ? 0 : -1}
                        disabled={!shown}
                        aria-pressed={picked === n}
                        aria-label={
                          shown && cup
                            ? `${customers.get(cup.customer)?.label ?? cup.customer}, served by ${rows[row].barista.name}: ${REACTION_LABELS[cup.reaction.reaction]}`
                            : "No reaction yet"
                        }
                        onClick={() => setPicked(picked === n ? null : n)}
                        onFocus={() => setRove(n)}
                        onKeyDown={(e) => onFaceKey(e, n)}
                      >
                        <motion.span
                          className="cn-face-wrap"
                          initial={false}
                          animate={{ scale: shown ? 1 : 0.7, opacity: shown ? 1 : 0.6 }}
                          transition={{ type: "spring", stiffness: 480, damping: 22 }}
                        >
                          <FaceGlyph reaction={cup?.reaction.reaction ?? "neutral"} empty={!shown} />
                        </motion.span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="cn-wall-pick" aria-live="polite">
        {pickedVisible && pickedCup && pickedRow ? (
          <>
            <FaceGlyph reaction={pickedCup.reaction.reaction} />
            <div>
              <p className="cn-wall-pick-head">
                {customers.get(pickedCup.customer)?.label ?? pickedCup.customer} at{" "}
                {pickedRow.store.name}, served by {pickedRow.barista.name}
              </p>
              <p className="cn-wall-pick-quote">&ldquo;{pickedCup.reaction.quote}&rdquo;</p>
              <p className="cn-wall-pick-meta">
                {REACTION_LABELS[pickedCup.reaction.reaction]} · satisfaction{" "}
                {pickedCup.reaction.satisfaction} · connection {pickedCup.reaction.connection} ·{" "}
                {pickedCup.reaction.noticed ? "noticed the cup" : "did not notice the cup"} · cup:{" "}
                {pickedCup.note_text
                  ? `${ACTION_LABELS[pickedCup.action].toLowerCase()}, “${pickedCup.note_text}”`
                  : "no note"}
              </p>
            </div>
          </>
        ) : (
          <p className="cn-hint">Click a face to read what that customer said.</p>
        )}
      </div>
    </div>
  );
}
