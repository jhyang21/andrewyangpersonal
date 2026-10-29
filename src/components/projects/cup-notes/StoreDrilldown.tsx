"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import type { CupNotesIndex, Reaction, ScenarioDetail } from "@/lib/cup-notes/types";
import { CupGlyph, FaceGlyph } from "./Glyphs";
import { ACTION_LABELS, REACTIONS, REACTION_LABELS, STANCE_LABELS } from "./shared";

type Props = {
  index: CupNotesIndex;
  detail: ScenarioDetail | null;
  storeKey: string | null;
  scenarioLabel: string;
  onClose: () => void;
};

function tenure(years: number) {
  return years < 1 ? `${Math.round(years * 12)} months` : `${years} ${years === 1 ? "year" : "years"}`;
}

/*
 * A native modal <dialog>: the browser traps focus inside it, closes it on Escape and hands focus
 * back to the "Open store" button that opened it, so none of that is rebuilt here.
 */
export function StoreDrilldown({ index, detail, storeKey, scenarioLabel, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (storeKey && !dialog.open) dialog.showModal();
    if (!storeKey && dialog.open) dialog.close();
  }, [storeKey]);

  const store = index.stores.find((s) => s.key === storeKey);
  const manager = detail?.managers.find((m) => m.store === storeKey);
  const shifts = detail?.shifts.filter((s) => s.store === storeKey) ?? [];
  const customers = new Map(index.customers.map((c) => [c.key, c]));
  const names = new Map(store?.baristas.map((b) => [b.key, b]) ?? []);

  const byReaction = new Map<Reaction, { who: string; by: string; quote: string }[]>();
  for (const shift of shifts) {
    for (const cup of shift.cups) {
      const list = byReaction.get(cup.reaction.reaction) ?? [];
      list.push({
        who: customers.get(cup.customer)?.label ?? cup.customer,
        by: names.get(shift.barista)?.name ?? shift.barista,
        quote: cup.reaction.quote,
      });
      byReaction.set(cup.reaction.reaction, list);
    }
  }

  return (
    <dialog
      ref={ref}
      className="cn-dialog"
      aria-labelledby="cn-dialog-title"
      onClose={onClose}
      onClick={(e) => {
        /* A click on the backdrop lands on the dialog element itself, not on its content. */
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      {store && manager && (
        <motion.div
          className="cn-dialog-body"
          key={storeKey}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <header className="cn-dialog-head">
            <div>
              <p className="cn-label">{scenarioLabel}</p>
              <h3 id="cn-dialog-title" className="cn-dialog-title">
                {store.name}
              </h3>
              <p className="cn-mgr-type">{store.type_label}</p>
            </div>
            <button
              type="button"
              className="cn-btn cn-btn-ghost cn-btn-icon"
              onClick={() => ref.current?.close()}
              aria-label="Close and return to the chain"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <p className="cn-dialog-setting">{store.setting}</p>

          <section className="cn-dialog-section">
            <h4>The manager</h4>
            <p className="cn-mgr-who">
              {store.manager.name}
              <span className="cn-chip">{store.manager.style_label}</span>
              <span className="cn-dim">{tenure(store.manager.tenure_years)} in the job</span>
            </p>
            <p className="cn-dim">Judged on {store.manager.judged_on}.</p>
            <div className="cn-mgr-flags">
              <span className={`cn-chip cn-stance cn-stance-${manager.stance}`}>
                {STANCE_LABELS[manager.stance]}
              </span>
              <span className="cn-chip cn-chip-quiet">
                {manager.tracks_compliance ? "Checking cups" : "Not checking"}
              </span>
              {manager.peak_exception && <span className="cn-chip cn-chip-quiet">Rush: may skip</span>}
              <span className="cn-chip cn-chip-quiet">Intensity {manager.intensity}</span>
              <span className="cn-chip cn-chip-quiet">Expects friction {manager.expected_friction}</span>
            </div>
            <div className="cn-said">
              <p className="cn-policy-tag">Said to the team</p>
              <p>&ldquo;{manager.message_to_team}&rdquo;</p>
            </div>
            <div className="cn-said cn-said-private">
              <p className="cn-policy-tag">Thought, not said</p>
              <p>{manager.private_thought}</p>
            </div>
          </section>

          {shifts.map((shift) => {
            const b = names.get(shift.barista);
            return (
              <section className="cn-dialog-section" key={shift.barista}>
                <h4>
                  {b?.name ?? shift.barista}
                  {b && <span className="cn-dim"> · {b.tenure}</span>}
                  {shift.fallback && <span className="cn-chip cn-chip-warn">Fallback</span>}
                </h4>
                <p className="cn-row-stats">
                  <span>Stress {shift.stress}</span>
                  <span>Sentiment {shift.sentiment}</span>
                </p>
                <p className="cn-dialog-quote">&ldquo;{shift.quote}&rdquo;</p>
                <ol className="cn-cuplist">
                  {shift.cups.map((cup) => (
                    <li key={cup.slot}>
                      <CupGlyph action={cup.action} />
                      <span>
                        {cup.slot + 1}. {customers.get(cup.customer)?.label ?? cup.customer}
                        <span className="cn-dim"> · {cup.queue} waiting</span>
                      </span>
                      <span className="cn-cuplist-note">
                        {cup.note_text ? (
                          <>
                            {ACTION_LABELS[cup.action]}: <em>&ldquo;{cup.note_text}&rdquo;</em>
                          </>
                        ) : (
                          <span className="cn-dim">No note</span>
                        )}
                      </span>
                      <span className="cn-cuplist-num">
                        +{cup.seconds_added} s · {cup.wait_min.toFixed(1)} min
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}

          <section className="cn-dialog-section">
            <h4>The customers, by reaction</h4>
            {REACTIONS.filter((r) => byReaction.has(r)).map((r) => (
              <div className="cn-react-group" key={r}>
                <p className="cn-react-head">
                  <FaceGlyph reaction={r} />
                  {REACTION_LABELS[r]}
                  <span className="cn-dim">{byReaction.get(r)?.length}</span>
                </p>
                <ul>
                  {byReaction.get(r)?.map((q, i) => (
                    <li key={i}>
                      <span className="cn-dim">
                        {q.who}, served by {q.by}:
                      </span>{" "}
                      &ldquo;{q.quote}&rdquo;
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </motion.div>
      )}
    </dialog>
  );
}
