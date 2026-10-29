"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import { motion } from "motion/react";
import type { CupNotesIndex, ScenarioDetail, Shift } from "@/lib/cup-notes/types";
import { CupGlyph, FaceGlyph } from "./Glyphs";
import { ACTION_LABELS, REACTION_LABELS, T, rowDone } from "./shared";

type Props = {
  index: CupNotesIndex;
  detail: ScenarioDetail | null;
  t: number;
};

type Hot = { row: number; slot: number };

/** The twelve rows in store order, then barista order, matched to their saved shift. */
export function shiftRows(index: CupNotesIndex, detail: ScenarioDetail | null) {
  return index.stores.flatMap((store) =>
    store.baristas.map((b) => ({
      store,
      barista: b,
      shift:
        detail?.shifts.find((s) => s.store === store.key && s.barista === b.key) ?? null,
    })),
  );
}

/*
 * Each row is one tab stop; the arrow keys move along and between rows. Ninety-six tab stops would
 * make the rest of the page unreachable from the keyboard in practice.
 */
function onCupKey(e: KeyboardEvent<HTMLButtonElement>, row: number, slot: number) {
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
  };
  const m = moves[e.key];
  if (!m) return;
  const next = e.currentTarget
    .closest(".cn-strip")
    ?.querySelector<HTMLButtonElement>(
      `[data-cup="${row + m[0]}-${slot + m[1]}"]`,
    );
  if (next) {
    e.preventDefault();
    next.focus();
  }
}

export function ShiftStrip({ index, detail, t }: Props) {
  const [hot, setHot] = useState<Hot | null>(null);
  const [rove, setRove] = useState<Hot>({ row: 0, slot: 0 });
  const customers = new Map(index.customers.map((c) => [c.key, c]));
  const rows = shiftRows(index, detail);

  return (
    <div className="cn-strip" onMouseLeave={() => setHot(null)}>
      {rows.map(({ store, barista, shift }, row) => {
        const done = shift !== null && t >= rowDone(row);
        return (
          <div className="cn-row" key={`${store.key}-${barista.key}`}>
            <div className="cn-row-who">
              <span className="cn-row-name">{barista.name}</span>
              <span className="cn-row-store">{store.name}</span>
              {shift?.fallback && <span className="cn-chip cn-chip-warn">Fallback</span>}
            </div>

            <div className="cn-row-cups" role="group" aria-label={`${barista.name}'s eight cups`}>
              {Array.from({ length: 8 }, (_, slot) => {
                const cup = shift?.cups[slot] ?? null;
                const poured = cup !== null && t >= T.cup(row, slot);
                const reacted = poured && t >= T.cup(row, slot) + T.reactionLag;
                const isHot = hot?.row === row && hot.slot === slot;
                const customer = cup ? customers.get(cup.customer) : undefined;
                return (
                  <span className="cn-cup-cell" key={slot}>
                    <button
                      type="button"
                      className="cn-cup-btn"
                      data-cup={`${row}-${slot}`}
                      tabIndex={rove.row === row && rove.slot === slot ? 0 : -1}
                      disabled={!poured}
                      aria-label={
                        poured && cup
                          ? `Cup ${slot + 1}, ${customer?.label ?? cup.customer}: ${ACTION_LABELS[cup.action]}${cup.note_text ? `, "${cup.note_text}"` : ""}, ${cup.seconds_added} seconds added`
                          : `Cup ${slot + 1}, not poured yet`
                      }
                      onMouseEnter={() => setHot({ row, slot })}
                      onFocus={() => {
                        setHot({ row, slot });
                        setRove({ row, slot });
                      }}
                      onBlur={() => setHot(null)}
                      onKeyDown={(e) => onCupKey(e, row, slot)}
                    >
                      <motion.span
                        className="cn-cup-wrap"
                        initial={false}
                        animate={{ scale: poured ? 1 : 0.86, opacity: poured ? 1 : 0.5 }}
                        transition={{ type: "spring", stiffness: 520, damping: 26 }}
                      >
                        <CupGlyph action={cup?.action ?? "skip"} empty={!poured} />
                      </motion.span>
                    </button>
                    {isHot && poured && cup && (
                      <span className={`cn-tip ${slot < 4 ? "cn-tip-l" : "cn-tip-r"}`} role="tooltip">
                        <span className="cn-tip-head">
                          Cup {slot + 1} · {customer?.label ?? cup.customer}
                        </span>
                        <span>
                          {cup.note_text ? (
                            <>
                              {ACTION_LABELS[cup.action]}: <em>&ldquo;{cup.note_text}&rdquo;</em>
                            </>
                          ) : (
                            "Nothing on the cup but a name"
                          )}
                        </span>
                        <span className="cn-tip-meta">
                          +{cup.seconds_added} s · {cup.queue} waiting · {cup.wait_min.toFixed(1)} min
                          wait
                        </span>
                        {reacted && (
                          <span className="cn-tip-react">
                            <FaceGlyph reaction={cup.reaction.reaction} />
                            <span>
                              <strong>{REACTION_LABELS[cup.reaction.reaction]}.</strong>{" "}
                              &ldquo;{cup.reaction.quote}&rdquo;
                            </span>
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>

            <RowEnd shift={done ? shift : null} />
          </div>
        );
      })}
    </div>
  );
}

function RowEnd({ shift }: { shift: Shift | null }) {
  return (
    <motion.div
      className="cn-row-end"
      initial={false}
      animate={{ opacity: shift ? 1 : 0 }}
      transition={{ duration: 0.4 }}
    >
      {shift && (
        <>
          <p className="cn-row-quote">&ldquo;{shift.quote}&rdquo;</p>
          <p className="cn-row-stats">
            <span>Stress {shift.stress}</span>
            <span>Sentiment {shift.sentiment}</span>
          </p>
        </>
      )}
    </motion.div>
  );
}
