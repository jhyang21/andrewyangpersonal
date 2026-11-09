// "Does it work?" on the method page: the feed back-test and the blind read.
import type { Backtest, BlindRead, BlindReadGroup, Method } from "@/apparatus-signals/lib/data";
import { formatDate, formatNumber, percent } from "@/apparatus-signals/lib/format";
import { kindLabel } from "@/apparatus-signals/lib/words";
import Ext from "@/apparatus-signals/ui/Ext";

const FEEDS: { key: string; label: string }[] = [
  { key: "grant", label: "Federal vehicle grant" },
  { key: "order", label: "Trade-press order" },
  { key: "delivery", label: "Trade-press delivery" },
];

function months(days: number): string {
  const m = Math.round(days / 30.4);
  return `${m} ${m === 1 ? "month" : "months"}`;
}

function aboutMonths(days: number | null): string {
  return days === null ? "None" : `about ${months(days)}`;
}

/** ", about N months ahead", or nothing when the lead is unknown. */
function ahead(g: BlindReadGroup): string {
  return g.median_lead_days === null ? "" : `, ${aboutMonths(g.median_lead_days)} ahead`;
}

const oneDecimal = (x: number) => (Math.round(x * 10) / 10).toFixed(1);

/** Best share any feed reached, for the summary lines. */
function bestFeedShare(bt: Backtest): string {
  const best = Math.max(...FEEDS.map((f) => bt.recall[f.key].rate ?? 0));
  return `${Math.round(best * 100)}%`;
}

/** The one-line summary the home page links from. */
export function testSummary(method: Method): string | null {
  const { backtest: bt, blind_read: br } = method;
  if (!bt || !br) return null;
  const sold = br.groups.sold;
  return `In a blind test, hand-read public records flagged ${percent(sold.sign_within_18_months, sold.departments)} of departments that later sold at auction${ahead(sold)}; the automatic feeds flagged about ${bestFeedShare(bt)}.`;
}

function NyLift({ bt }: { bt: Backtest }) {
  const ny = bt.precision.NY;
  const rows = [ny?.grant, ny?.grant_all_years].filter(
    (r): r is NonNullable<typeof r> => !!r && r.lift !== null,
  );
  if (!rows.length) return null;
  const lifts = rows.map((r) => r.lift as number);
  const sold = rows.map((r) => r.sold_within_24m);
  const range = (xs: string[]) => (xs[0] === xs[1] ? xs[0] : `${xs[0]} to ${xs[1]}`);
  const liftText = range([oneDecimal(Math.min(...lifts)), oneDecimal(Math.max(...lifts))]);
  const soldText = range([String(Math.min(...sold)), String(Math.max(...sold))]);
  return (
    <p className="max-w-3xl">
      In New York, departments that won a grant sold a truck at auction within two years at{" "}
      {liftText} times the usual rate, but that is {soldText} sales.
    </p>
  );
}

function FeedTable({ bt }: { bt: Backtest }) {
  return (
    <div className="space-y-3">
      <table className="data-table">
        <caption>Automatic feeds against {formatNumber(bt.meta.lots_used)} real auction sales</caption>
        <thead>
          <tr>
            <th scope="col">Feed</th>
            <th scope="col" className="r">
              Sales the feed could have seen
            </th>
            <th scope="col" className="r">
              Had the signal first
            </th>
            <th scope="col" className="r">
              Share
            </th>
            <th scope="col">Median lead</th>
          </tr>
        </thead>
        <tbody>
          {FEEDS.map((f) => {
            const r = bt.recall[f.key];
            return (
              <tr key={f.key}>
                <td className="font-semibold">{f.label}</td>
                <td className="r" data-label="Sales the feed could have seen">
                  {formatNumber(r.sales_coverable)}
                </td>
                <td className="r" data-label="Had the signal first">
                  {formatNumber(r.sales_with_signal)}
                </td>
                <td className="r" data-label="Share">
                  {percent(r.sales_with_signal, r.sales_coverable, 1)}
                </td>
                <td data-label="Median lead">{aboutMonths(r.median_lead_days)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="max-w-3xl text-sm text-as-ink-2">
        Fire trucks only ({formatNumber(bt.meta.sale_events_apparatus)} sales); ambulances are
        counted separately. A grant counts if it came 3 months to 5 years before the sale, an order
        up to 30 months before. A sale counts only if the feed was printing during that span; we
        read the trade press only from 2025, so few sales could be checked against it. We read only
        one auction site, so a department that sold through a dealer or another site looks like a
        miss: every share here is a floor.
      </p>
    </div>
  );
}

function BlindRow({ label, g }: { label: string; g: BlindReadGroup }) {
  return (
    <tr>
      <td className="font-semibold">{label}</td>
      <td className="r" data-label="Departments">
        {formatNumber(g.departments)}
      </td>
      <td className="r" data-label="Sign within 18 months">
        {formatNumber(g.sign_within_18_months)}
      </td>
      <td className="r" data-label="Share">
        {percent(g.sign_within_18_months, g.departments)}
      </td>
      <td data-label="Median lead">{aboutMonths(g.median_lead_days)}</td>
    </tr>
  );
}

function BlindTable({ br, method }: { br: BlindRead; method: Method }) {
  const kinds = Object.entries(br.groups.sold.kinds).sort(
    (a, b) => b[1] - a[1] || kindLabel(a[0], method).localeCompare(kindLabel(b[0], method)),
  );
  return (
    <div className="space-y-4">
      <p className="max-w-3xl">{br.meta.design}</p>
      <table className="data-table">
        <caption>Hand-read records, blind test</caption>
        <thead>
          <tr>
            <th scope="col">Group</th>
            <th scope="col" className="r">
              Departments
            </th>
            <th scope="col" className="r">
              Sign within 18 months
            </th>
            <th scope="col" className="r">
              Share
            </th>
            <th scope="col">Median lead</th>
          </tr>
        </thead>
        <tbody>
          <BlindRow label="Sold a truck at auction" g={br.groups.sold} />
          <BlindRow label="Did not" g={br.groups.control} />
        </tbody>
      </table>
      <div className="max-w-3xl">
        <h4 className="font-semibold">What the signs were, for departments that sold</h4>
        <ul className="mt-1 list-disc pl-5">
          {kinds.map(([k, n]) => (
            <li key={k}>
              {kindLabel(k, method)}: {n}
            </li>
          ))}
        </ul>
      </div>
      <div className="max-w-3xl">
        <h4 className="font-semibold">Where this could be wrong</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {br.meta.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
      <details>
        <summary className="cursor-pointer text-as-link">
          The {formatNumber(br.hits.length)} verified signs
        </summary>
        <ul className="mt-2 max-w-3xl space-y-3 text-sm">
          {br.hits.map((h) => (
            <li key={`${h.department}-${h.signal_date}-${h.kind}`}>
              <span className="font-semibold">{h.department}</span> ({h.county} County)
              {h.group === "control" ? <span className="text-as-ink-2">, no sale seen yet</span> : null}
              <div>
                {kindLabel(h.kind, method)}, {formatDate(h.signal_date)},{" "}
                {months(h.lead_days)} before.{" "}
                <Ext href={h.url}>Proof</Ext>
              </div>
              <blockquote className="mt-1 border-l-2 border-as-rule pl-3 text-as-ink-2">
                &ldquo;{h.quote}&rdquo;
              </blockquote>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export default function DoesItWork({ method }: { method: Method }) {
  const { backtest: bt, blind_read: br } = method;
  if (!bt || !br) return null;
  const sold = br.groups.sold;
  const control = br.groups.control;
  return (
    <section aria-labelledby="does-it-work" className="space-y-6">
      <h2 id="does-it-work" className="text-xl font-semibold">
        Does it work?
      </h2>
      <p className="max-w-3xl">
        We checked two ways. Against {formatNumber(bt.meta.lots_used)} closed lots, a grant or
        order came first in about {bestFeedShare(bt)} of sales. Then{" "}
        {formatNumber(sold.departments + control.departments)} New York departments, blind: a prior
        sign for {percent(sold.sign_within_18_months, sold.departments)} of sellers against{" "}
        {percent(control.sign_within_18_months, control.departments)} of non-sellers. Small numbers.
      </p>
      <FeedTable bt={bt} />
      <NyLift bt={bt} />
      <h3 className="text-lg font-semibold">Hand-read records</h3>
      <BlindTable br={br} method={method} />
    </section>
  );
}
