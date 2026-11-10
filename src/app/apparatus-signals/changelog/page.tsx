import type { Metadata } from "next";
import Link from "next/link";
import { BASE } from "@/apparatus-signals/lib/site";
import {
  getChangelog,
  getMethod,
  getState,
  type ChangelogRun,
  type Method,
} from "@/apparatus-signals/lib/data";
import { formatDate, formatNumber, lowerFirst, plural } from "@/apparatus-signals/lib/format";
import { kindLabel } from "@/apparatus-signals/lib/words";

export const metadata: Metadata = {
  title: "Changelog",
  description: "What each refresh added and dropped.",
};

/** Lines look like "NY: Name (why)". Group them by state code. */
function byState(lines: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const line of lines) {
    const m = /^([A-Z]{2}):\s*(.*)$/.exec(line);
    const code = m ? m[1] : "";
    const text = m ? m[2] : line;
    groups.set(code, [...(groups.get(code) ?? []), text]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function LeadList({ lines, total, verb }: { lines: string[]; total: number; verb: string }) {
  if (total === 0) return <p className="text-as-ink-2">None {verb}.</p>;
  return (
    <details>
      <summary className="cursor-pointer text-as-link">
        {plural(total, "lead")} {verb}
      </summary>
      {total > lines.length ? (
        <p className="mt-2 text-sm text-as-ink-2">
          Showing the first {formatNumber(lines.length)} of {formatNumber(total)}.
        </p>
      ) : null}
      <div className="mt-2 space-y-3 text-sm">
        {byState(lines).map(([code, items]) => {
          const state = code ? getState(code) : undefined;
          return (
            <div key={code || "other"}>
              <h4 className="font-semibold">
                {state ? <Link href={`${BASE}/${state.code.toLowerCase()}`}>{state.name}</Link> : "Other"}
              </h4>
              <ul className="list-disc pl-5">
                {items.map((t, i) => (
                  <li key={`${t}-${i}`}>{t}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </details>
  );
}

/** Feed adds show as counts; hand-read adds are named. */
function NewLeads({ run, method }: { run: ChangelogRun; method: Method }) {
  const feeds = run.new_from_feeds ?? [];
  const feedTotal = feeds.reduce((n, f) => n + f.count, 0);
  const handTotal = Math.max(run.new_leads.length, run.new_lead_count - feedTotal);
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">New</h3>
      {feeds.length ? (
        <ul className="list-disc pl-5">
          {feeds.map((f) => (
            <li key={`${f.kind}-${f.source}`}>
              {plural(f.count, "lead")} from the {f.source}:{" "}
              {lowerFirst(kindLabel(f.kind, method))}.
            </li>
          ))}
        </ul>
      ) : null}
      {handTotal > 0 ? (
        <LeadList lines={run.new_leads} total={handTotal} verb="read by hand" />
      ) : feeds.length === 0 ? (
        <p className="text-as-ink-2">None added.</p>
      ) : null}
    </div>
  );
}

export default function ChangelogPage() {
  const method = getMethod();
  const runs = [...getChangelog()].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Changelog</h1>
        <p className="mt-2 max-w-3xl text-lg text-as-ink-2">
          One entry per refresh, newest first.
        </p>
      </header>
      {runs.length === 0 ? <p>No runs yet.</p> : null}
      {runs.map((run) => (
        <section
          key={run.date}
          aria-labelledby={`run-${run.date}`}
          className="space-y-3 border-t border-as-rule pt-4"
        >
          <h2 id={`run-${run.date}`} className="text-xl font-semibold">
            <time dateTime={run.date}>{formatDate(run.date)}</time>
          </h2>
          {run.note ? <p className="max-w-3xl">{run.note}</p> : null}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ["Call this week", run.leads_week],
                ["Read by hand", run.hand_read_leads],
                ["With a seen signal", run.observed_leads],
                ["Leads", run.leads],
                ["States", run.states],
                ["Signals", run.signals],
              ] as [string, number | undefined][]
            )
              .filter(([, value]) => value !== undefined)
              .map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-as-muted">{label}</dt>
                <dd className="num text-2xl font-semibold">{formatNumber(Number(value))}</dd>
              </div>
            ))}
          </dl>
          <NewLeads run={run} method={method} />
          <div className="space-y-2">
            <h3 className="font-semibold">Dropped</h3>
            <LeadList lines={run.dropped} total={run.dropped_count} verb="dropped" />
          </div>
        </section>
      ))}
    </div>
  );
}
