import Link from "next/link";
import { getIndex, getLeverText } from "@/cup-notes/lib/data";
import { findings } from "@/cup-notes/lib/findings";
import {
  DEFAULT_SELECTION,
  LEVER_ORDER,
  ruleAndShiftCounts,
  scenarioKey,
  scenarioName,
} from "@/cup-notes/lib/levers";
import { BASE, runHref } from "@/cup-notes/lib/site";
import type { LeverSelection } from "@/cup-notes/lib/types";
import { LEVER_INTRO, LEVER_TITLES, MEMO_LINES, findingSentences } from "@/cup-notes/lib/words";
import { RunsTable } from "@/cup-notes/ui/RunsTable";
import { TradeoffChart } from "@/cup-notes/ui/TradeoffChart";

export default function CupNotesHome() {
  const index = getIndex();
  const text = getLeverText();
  const found = findings(index);
  const { rules, shifts } = ruleAndShiftCounts(index);
  const byKey = new Map(index.scenarios.map((s) => [s.key, s]));
  const opts = (lever: keyof LeverSelection) => index.levers[lever];

  /* Rows: the rule (enforcement × note). Columns: the shift (traffic × staffing). */
  const rows = opts("enforcement").flatMap((e) => opts("note").map((n) => ({ e, n })));
  const cols = opts("traffic").flatMap((tr) => opts("staffing").map((st) => ({ tr, st })));

  return (
    <div className="space-y-12">
      <header className="max-w-3xl space-y-4">
        <h1 className="text-3xl font-semibold sm:text-4xl">The cup note</h1>
        <div className="cn-prose text-lg">
          <p>
            Starbucks told baristas to write a note on every cup. Saturday, 8:40, line out the door:
            a smiley. Two pm, dead quiet: a whole sentence. Same rule, different cup.
          </p>
          <p>
            The rule was never the decision. The rollout was. Mandate it or ask nicely? Full note, or
            does a smiley count in a rush? Baristas said peak is when it hurts. The union took it to
            the labor board.
          </p>
          <p>
            So I ran it. Six stores, twelve baristas, 96 customers, every one played by a model,
            under {rules} versions of the rule and {shifts} kinds of shift. {index.scenarios.length}{" "}
            runs. Pick a run.
          </p>
        </div>
      </header>

      <section aria-labelledby="runs-title" className="space-y-3">
        <h2 id="runs-title" className="text-2xl font-semibold">
          The {index.scenarios.length} runs
        </h2>
        <p className="max-w-3xl text-cn-muted">
          Rows are the rule, columns the shift. Each cell is one run: share of cups with a note, and
          customer satisfaction.
        </p>
        <div className="cn-table-wrap">
          <table className="cn-grid">
            <thead>
              <tr>
                <td />
                {cols.map(({ tr, st }) => (
                  <th scope="col" key={`${tr.key}-${st.key}`}>
                    {tr.label}
                    <span className="cn-dim"> · {st.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, n }) => (
                <tr key={`${e.key}-${n.key}`}>
                  <th scope="row">
                    {e.label}
                    <span className="cn-dim"> · {n.label}</span>
                  </th>
                  {cols.map(({ tr, st }) => {
                    const sel = { enforcement: e.key, note: n.key, traffic: tr.key, staffing: st.key };
                    const s = byKey.get(scenarioKey(sel));
                    return (
                      <td key={`${tr.key}-${st.key}`}>
                        {s ? (
                          <Link href={runHref(s.key)}>
                            <span className="sr-only">{scenarioName(index, sel)}: </span>
                            <span className="cn-grid-main">{Math.round(s.outcomes.compliance_pct)}%</span>
                            <span className="cn-grid-sub">
                              satisfaction {Math.round(s.outcomes.customer_satisfaction)}
                            </span>
                          </Link>
                        ) : (
                          <span className="cn-dim">–</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Not sure where to start? The hardest shift under the strictest rule:{" "}
          <Link href={runHref(scenarioKey(DEFAULT_SELECTION))}>
            {scenarioName(index, DEFAULT_SELECTION)}
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="levers-title" className="space-y-4">
        <h2 id="levers-title" className="text-2xl font-semibold">
          The four levers
        </h2>
        <p className="max-w-3xl text-cn-muted">
          {MEMO_LINES}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {LEVER_ORDER.map((lever) => (
            <div key={lever} className="cn-card cn-lever-card">
              <h3 className="font-semibold">
                {LEVER_TITLES[lever]}
                <span className="font-normal text-cn-muted"> · {LEVER_INTRO[lever]}</span>
              </h3>
              <dl className="mt-3 space-y-3">
                {index.levers[lever].map((o) => (
                  <div key={o.key}>
                    <dt className="font-medium">
                      {o.label}
                      <span className="font-normal text-cn-muted"> · {o.short}</span>
                    </dt>
                    <dd className="cn-memo-line">&ldquo;{text[lever][o.key]}&rdquo;</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      {found && (
        <section aria-labelledby="found-title" className="max-w-3xl space-y-3">
          <h2 id="found-title" className="text-2xl font-semibold">
            What came out
          </h2>
          <ul className="cn-prose list-disc space-y-2 pl-5">
            {findingSentences(found).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="all-title" className="space-y-4">
        <h2 id="all-title" className="text-2xl font-semibold">
          Side by side
        </h2>
        <TradeoffChart index={index} selection={null} />
        <RunsTable index={index} />
      </section>

      <p className="max-w-3xl">
        How the people, prompts and numbers were made: <Link href={`${BASE}/method`}>Method</Link>.
      </p>
    </div>
  );
}
