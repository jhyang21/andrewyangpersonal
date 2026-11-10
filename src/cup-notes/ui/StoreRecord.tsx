import type { CupNotesIndex, Reaction, ScenarioDetail, Store } from "@/cup-notes/lib/types";
import {
  ACTION_LABELS,
  MANAGER_FLAGS,
  NO_NOTE,
  REACTIONS,
  REACTION_LABELS,
  STANCE_LABELS,
  tenure,
} from "@/cup-notes/lib/words";
import { CupGlyph, FaceGlyph } from "./Glyphs";

type Props = {
  index: CupNotesIndex;
  detail: ScenarioDetail;
  store: Store;
};

/*
 * One store's whole shift in this run, inline on the run page: what the manager said and thought,
 * every cup each barista made, and every customer's words grouped by reaction. The "Open store" link
 * on each manager card jumps here. Server component.
 */
export function StoreRecord({ index, detail, store }: Props) {
  const manager = detail.managers.find((m) => m.store === store.key);
  const shifts = detail.shifts.filter((s) => s.store === store.key);
  const customers = new Map(index.customers.map((c) => [c.key, c]));
  const names = new Map(store.baristas.map((b) => [b.key, b]));
  if (!manager) return null;

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

  const titleId = `store-${store.key}-title`;
  return (
    <section id={`store-${store.key}`} className="cn-card cn-record" aria-labelledby={titleId}>
      <header>
        <h3 id={titleId} className="cn-record-title">
          {store.name}
        </h3>
        <p className="cn-mgr-type">{store.type_label}</p>
      </header>

      <p className="cn-record-setting">{store.setting}</p>

      <div className="cn-record-section">
        <h4>The manager</h4>
        <p className="cn-mgr-who">
          {store.manager.name}
          <span className="cn-chip">{store.manager.style_label}</span>
          <span className="cn-dim">{tenure(store.manager.tenure_years)} in the job</span>
        </p>
        <p className="cn-dim">Judged on {store.manager.judged_on}.</p>
        <div className="cn-mgr-flags">
          <span className={`cn-chip cn-stance-${manager.stance}`}>
            {STANCE_LABELS[manager.stance]}
          </span>
          <span className="cn-chip cn-chip-quiet">
            {manager.tracks_compliance ? MANAGER_FLAGS.checking : MANAGER_FLAGS.notChecking}
          </span>
          {manager.peak_exception && <span className="cn-chip cn-chip-quiet">{MANAGER_FLAGS.rushSkip}</span>}
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
      </div>

      {shifts.map((shift) => {
        const b = names.get(shift.barista);
        return (
          <div className="cn-record-section" key={shift.barista}>
            <h4>
              {b?.name ?? shift.barista}
              {b && <span className="cn-dim"> · {b.tenure}</span>}
              {shift.fallback && <span className="cn-chip cn-chip-warn">Fallback</span>}
            </h4>
            <p className="cn-row-stats">
              <span>Stress {shift.stress}</span>
              <span>Sentiment {shift.sentiment}</span>
            </p>
            <p className="cn-record-quote">&ldquo;{shift.quote}&rdquo;</p>
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
                      <span className="cn-dim">{NO_NOTE}</span>
                    )}
                  </span>
                  <span className="cn-cuplist-num">
                    +{cup.seconds_added} s · {cup.wait_min.toFixed(1)} min
                  </span>
                </li>
              ))}
            </ol>
          </div>
        );
      })}

      <div className="cn-record-section">
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
      </div>
    </section>
  );
}
