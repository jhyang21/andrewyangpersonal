import Link from "next/link";
import {
  allLeads,
  compareLeads,
  departmentHref,
  getMeta,
  getMethod,
  getStates,
  leadsPer100,
  stageTotals,
} from "@/apparatus-signals/lib/data";
import {
  formatDate,
  formatNumber,
  formatScore,
  joinPlain,
  likelyListed,
  tierLabel,
} from "@/apparatus-signals/lib/format";
import { binLabel, buildScale } from "@/apparatus-signals/lib/scale";
import { BASE, SITE_QUESTION } from "@/apparatus-signals/lib/site";
import { guideTotalLine } from "@/apparatus-signals/lib/trucks";
import {
  COVERAGE,
  COVERAGE_ORDER,
  READ_BY_LABEL,
  WEEK_RULE,
  isOpenStage,
} from "@/apparatus-signals/lib/words";
import BasisBadge from "@/apparatus-signals/ui/Basis";
import { testSummary } from "@/apparatus-signals/ui/DoesItWork";
import UsMap, { type MapState } from "@/apparatus-signals/ui/UsMap";

export default function HomePage() {
  const meta = getMeta();
  const { totals } = meta;
  const stages = stageTotals();
  const summary = testSummary(getMethod());
  const states = getStates();
  const scale = buildScale(states.map(leadsPer100));
  const deepNames = states.filter((s) => s.coverage === "deep").map((s) => s.name);
  const mapStates: MapState[] = states.map((s) => ({
    code: s.code,
    name: s.name,
    leads: s.leads.total,
    rate: leadsPer100(s),
    bin: scale.binFor(leadsPer100(s)),
    deep: s.coverage === "deep",
    coverageName: COVERAGE[s.coverage].name,
  }));
  // The Top 10 is for trucks not yet on a channel; listed and sold leads stay on the state pages.
  const top = allLeads()
    .filter((d) => isOpenStage(d.stage))
    .sort(compareLeads)
    .slice(0, 10);
  const topDeep = top.filter((d) => totals.deep_states.includes(d.stateCode)).length;
  const coverageCounts = COVERAGE_ORDER.map((c) => ({
    coverage: c,
    count: states.filter((s) => s.coverage === c).length,
  }));

  const headline = [
    { value: stages.not_listed_soon, label: "to call before they list" },
    { value: stages.listed, label: "at auction now" },
    { value: stages.sold, label: "sold since May" },
  ];
  const stats = [
    {
      label: "Leads in all",
      value: formatNumber(totals.leads),
      note: `${formatNumber(totals.leads - totals.observed_leads)} are inferred from a grant, an order or a vote to buy. No one has seen the old truck yet.`,
    },
    { label: "Seen, not inferred", value: formatNumber(totals.observed_leads) },
    { label: "Fire departments covered", value: formatNumber(totals.departments_in_registry) },
    {
      label: "States read by hand",
      value: formatNumber(totals.deep_states.length),
      note: joinPlain(deepNames),
    },
  ];

  return (
    <div className="space-y-10">
      <section aria-labelledby="page-title">
        <h1 id="page-title" className="text-3xl font-semibold sm:text-4xl">
          {SITE_QUESTION}
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-as-ink-2">
          When a department wins a vehicle grant, orders a new truck or votes to sell an old one, a
          used truck follows a few months to a few years later. This is the list, by state, with
          the record behind each lead.
        </p>
        {summary ? (
          <p className="mt-2 max-w-3xl">
            {summary} <Link href={`${BASE}/method#does-it-work`}>How we checked.</Link>
          </p>
        ) : null}
        <p className="mt-2 text-sm text-as-muted">Last updated {formatDate(meta.updated)}.</p>
      </section>

      <section aria-label="Headline numbers" className="space-y-4 border-y border-as-rule py-4">
        <p className="text-2xl font-semibold sm:text-3xl">
          {headline.map((h, i) => (
            <span key={h.label}>
              {i > 0 ? <span className="text-as-muted" aria-hidden="true"> · </span> : null}
              <span className="num">{formatNumber(h.value)}</span> {h.label}
            </span>
          ))}
        </p>
        <p className="text-sm text-as-ink-2">
          {WEEK_RULE} &ldquo;{READ_BY_LABEL.person}&rdquo; means we opened the page; it did not
          come off the grant or trade-press feed.
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-sm text-as-ink-2">{s.label}</dt>
              <dd className="text-xl font-semibold">{s.value}</dd>
              {s.note ? <dd className="text-sm text-as-muted">{s.note}</dd> : null}
            </div>
          ))}
        </dl>
        <p className="text-sm text-as-ink-2">
          {guideTotalLine(totals.guide_total)}{" "}
          <Link href={`${BASE}/method#price-guide`}>How the guide works</Link>
        </p>
      </section>

      <section aria-labelledby="map-title" className="space-y-4">
        <div>
          <h2 id="map-title" className="text-xl font-semibold">
            Leads per 100 fire departments
          </h2>
          <p className="text-sm text-as-ink-2">
            Darker: more leads per department. Heavy outline: read by hand. Pick a state.
          </p>
        </div>
        <UsMap states={mapStates} />
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Leads per 100 departments</h3>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <span className="bg-fill-0 inline-block h-3 w-6 rounded-sm" aria-hidden="true" />
                None found
              </li>
              {scale.bins.map((b) => (
                <li key={b.index} className="flex items-center gap-2">
                  <span
                    className={`bg-fill-${b.index} inline-block h-3 w-6 rounded-sm`}
                    aria-hidden="true"
                  />
                  <span className="num">{binLabel(b)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">How closely each state is read</h3>
            <ul className="space-y-2 text-sm">
              {coverageCounts.map(({ coverage, count }) => (
                <li key={coverage}>
                  <span className="font-semibold">{COVERAGE[coverage].name}</span>{" "}
                  <span className="text-as-muted">
                    ({count} {count === 1 ? "state" : "states"})
                  </span>
                  {coverage === "deep" ? (
                    <span className="ml-1 inline-block h-3 w-5 rounded-sm border-2 border-as-ink align-middle" aria-hidden="true" />
                  ) : null}
                  <br />
                  <span className="text-as-ink-2">{COVERAGE[coverage].long}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-as-link">All states as a table</summary>
          <table className="data-table mt-2">
            <caption className="sr-only">Leads and coverage by state</caption>
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col" className="r">
                  Leads
                </th>
                <th scope="col" className="r">
                  Departments
                </th>
                <th scope="col" className="r">
                  Per 100
                </th>
                <th scope="col">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {states.map((s) => (
                <tr key={s.code}>
                  <td>
                    <Link href={`${BASE}/${s.code.toLowerCase()}`}>{s.name}</Link>
                  </td>
                  <td className="r" data-label="Leads">
                    {formatNumber(s.leads.total)}
                  </td>
                  <td className="r" data-label="Departments">
                    {formatNumber(s.departments)}
                  </td>
                  <td className="r" data-label="Per 100">
                    {leadsPer100(s).toFixed(1)}
                  </td>
                  <td data-label="Coverage">{COVERAGE[s.coverage].name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section aria-labelledby="top-title">
        <h2 id="top-title" className="text-xl font-semibold">
          Top 10 leads in all states
        </h2>
        <p className="mb-3 text-sm text-as-ink-2">
          Ranked by score.
          {deepNames.length && topDeep > top.length / 2
            ? ` ${joinPlain(deepNames)} ${deepNames.length === 1 ? "is" : "are"} read by hand, so ${deepNames.length === 1 ? "it fills" : "they fill"} most of the list.`
            : ""}
        </p>
        <table className="data-table">
          <caption className="sr-only">Top 10 leads in all states</caption>
          <thead>
            <tr>
              <th scope="col" className="r">
                #
              </th>
              <th scope="col">Department</th>
              <th scope="col">Why call</th>
              <th scope="col">Likely listed</th>
              <th scope="col">When</th>
              <th scope="col" className="r">
                Score
              </th>
              <th scope="col">Date</th>
            </tr>
          </thead>
          <tbody>
            {top.map((d, i) => (
              <tr key={`${d.stateCode}-${d.id}`}>
                <td className="r text-as-muted" data-label="Rank">
                  {i + 1}
                </td>
                <td>
                  <Link href={departmentHref(d.stateCode, d)} className="font-semibold">
                    {d.department}
                  </Link>
                  <div className="text-sm text-as-muted">
                    {[d.city, d.stateName].filter(Boolean).join(", ")}
                  </div>
                </td>
                <td data-label="Why call">
                  {d.why_call}
                  {d.detail ? <div className="text-sm text-as-ink-2">{d.detail}</div> : null}
                </td>
                <td className="whitespace-nowrap" data-label="Likely listed">
                  {likelyListed(d)}
                </td>
                <td data-label="When">
                  {tierLabel(d.tier)} <BasisBadge basis={d.basis} />
                </td>
                <td className="r" data-label="Score">
                  {formatScore(d.score)}
                </td>
                <td className="num whitespace-nowrap" data-label="Date">
                  {formatDate(d.signal_date) || "Not known"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm text-as-ink-2">
          {formatNumber(stages.listed)} more are at auction now and {formatNumber(stages.sold)} sold
          this year; see each state.
        </p>
      </section>
    </div>
  );
}
