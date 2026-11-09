import type { Metadata } from "next";
import Link from "next/link";
import { BASE } from "@/apparatus-signals/lib/site";
import { getMeta, getMethod, getSales, getState, getStates } from "@/apparatus-signals/lib/data";
import { formatDate, formatMoney, formatNumber, plural, tierLabel } from "@/apparatus-signals/lib/format";
import { ageBuckets, lotsByState, medianPrice, splitSales } from "@/apparatus-signals/lib/sales";
import { BASIS_LABEL, VERDICT_LABELS, WEEK_RULE, kindLabel, modifierLabel } from "@/apparatus-signals/lib/words";
import { LeadTimeChart, PriceByAgeChart } from "@/apparatus-signals/ui/charts";
import DoesItWork from "@/apparatus-signals/ui/DoesItWork";
import Ext from "@/apparatus-signals/ui/Ext";
import { RuleBox } from "@/apparatus-signals/ui/StateBits";

export const metadata: Metadata = {
  title: "Method",
  description: "Where the leads come from, how they are scored, and what the list cannot see.",
};

export default function MethodPage() {
  const meta = getMeta();
  const method = getMethod();
  const states = getStates();
  const sales = splitSales(getSales());
  const buckets = ageBuckets(sales.lots);
  const medianAll = medianPrice(sales.lots);
  const byState = lotsByState(sales.sold);
  const ruleStates = states.filter((s) => s.rule ?? method.rules[s.code]);
  const kinds = Object.keys(method.points).sort(
    (a, b) => method.points[b] - method.points[a] || a.localeCompare(b),
  );
  const tiers = [...method.tiers].sort((a, b) => b.floor - a.floor);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-3xl font-semibold">Method</h1>
        <p className="mt-2 max-w-3xl text-lg text-as-ink-2">
          Each lead is a fire department with a public sign that it will soon sell a truck. Signs
          are read from the sources below, given points, and summed into a score.
        </p>
      </header>

      <section aria-labelledby="sources">
        <h2 id="sources" className="mb-3 text-xl font-semibold">
          Sources
        </h2>
        <table className="data-table">
          <caption className="sr-only">Sources</caption>
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">What it gives</th>
              <th scope="col">Last read</th>
            </tr>
          </thead>
          <tbody>
            {meta.sources.map((s) => (
              <tr key={s.name}>
                <td>
                  <Ext href={s.url}>{s.name}</Ext>
                </td>
                <td data-label="What it gives">{s.note}</td>
                <td className="num whitespace-nowrap" data-label="Last read">
                  {s.read ? formatDate(s.read) : "Not dated"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <DoesItWork method={method} />

      <section aria-labelledby="scoring" className="space-y-6">
        <h2 id="scoring" className="text-xl font-semibold">
          Scoring
        </h2>
        <p className="max-w-3xl">
          Each signal earns points for its kind, plus or minus the modifiers that apply to it. A
          department&rsquo;s score is its strongest signal in full plus half of the best signal of
          each other kind. The score sets when to call. {WEEK_RULE} A lead built only on guesses
          (a grant, an order, a due date) stops at &ldquo;Call this month&rdquo;, however high its
          score.
        </p>
        <div className="grid gap-8 lg:grid-cols-2">
          <table className="data-table">
            <caption>Points per signal</caption>
            <thead>
              <tr>
                <th scope="col">Signal</th>
                <th scope="col">Seen or expected</th>
                <th scope="col" className="r">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {kinds.map((k) => (
                <tr key={k}>
                  <td>{kindLabel(k, method)}</td>
                  <td data-label="Seen or expected">
                    {BASIS_LABEL[method.observed.includes(k) ? "observed" : "expected"]}
                  </td>
                  <td className="r" data-label="Points">
                    {method.points[k]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-8">
            <table className="data-table">
              <caption>Modifiers</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col" className="r">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(method.modifiers).map(([name, v]) => (
                  <tr key={name}>
                    <td>{modifierLabel(name)}</td>
                    <td className="r" data-label="Points">
                      {v > 0 ? `+${v}` : `−${Math.abs(v)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="data-table">
              <caption>When to call</caption>
              <thead>
                <tr>
                  <th scope="col">Score</th>
                  <th scope="col">Tier</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t, i) => (
                  <tr key={t.label}>
                    <td className="num">
                      {i === 0
                        ? `${t.floor} or more`
                        : `${t.floor} to under ${tiers[i - 1].floor}`}
                    </td>
                    <td data-label="Tier">{tierLabel(t.label)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="hit-rates" className="space-y-3">
        <h2 id="hit-rates" className="text-xl font-semibold">
          What each signal led to
        </h2>
        <p className="max-w-3xl">
          Counted by hand in the states read in depth. Small numbers: read them as stories, not
          rates.
        </p>
        <table className="data-table">
          <caption className="sr-only">Hit rates by signal</caption>
          <thead>
            <tr>
              <th scope="col">Signal</th>
              <th scope="col" className="r">
                Found
              </th>
              <th scope="col">What happened next</th>
              <th scope="col">As of</th>
            </tr>
          </thead>
          <tbody>
            {method.hit_rates.map((h) => (
              <tr key={`${h.state}-${h.signal}`}>
                <td className="font-semibold">{h.signal}</td>
                <td className="r" data-label="Found">
                  {h.found}
                </td>
                <td data-label="What happened next">{h.next}</td>
                <td className="num whitespace-nowrap" data-label="As of">
                  {h.state}, {formatDate(h.as_of)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="lead-time" className="space-y-4">
        <h2 id="lead-time" className="text-xl font-semibold">
          How early the signs show
        </h2>
        <p className="max-w-3xl">
          For trucks now at auction, a person searched back for the first public sign of the sale
          and counted the months to the listing.
        </p>
        <div className="max-w-3xl">
          <LeadTimeChart cases={method.lead_time_cases} />
        </div>
        <details>
          <summary className="cursor-pointer text-as-link">Each case in full</summary>
          <table className="data-table mt-2 text-sm">
            <caption className="sr-only">Lead-time cases</caption>
            <thead>
              <tr>
                <th scope="col">Seller and truck</th>
                <th scope="col">Auction ends</th>
                <th scope="col">Finding</th>
                <th scope="col">First sign</th>
              </tr>
            </thead>
            <tbody>
              {method.lead_time_cases.map((c) => (
                <tr key={`${c.seller}-${c.truck}`}>
                  <td>
                    <span className="font-semibold">{c.seller}</span>
                    <div>{c.truck}</div>
                  </td>
                  <td className="num whitespace-nowrap" data-label="Auction ends">
                    {formatDate(c.auction_close)}
                  </td>
                  <td data-label="Finding">
                    {VERDICT_LABELS[c.verdict] ?? c.verdict}
                    {c.months_before_listing !== null
                      ? `, ${c.months_before_listing} months before`
                      : ""}
                  </td>
                  <td data-label="First sign">
                    {c.trace ? (
                      <>
                        {c.trace_date ? `${formatDate(c.trace_date)}: ` : ""}
                        {c.trace}
                        {c.url ? (
                          <>
                            {" "}
                            <Ext href={c.url}>Source</Ext>
                          </>
                        ) : null}
                      </>
                    ) : (
                      "None found"
                    )}
                    <p className="mt-1 text-as-ink-2">{c.note}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section aria-labelledby="prices" className="space-y-4">
        <h2 id="prices" className="text-xl font-semibold">
          What old trucks sell for
        </h2>
        <p className="max-w-3xl">
          {plural(sales.sold.length, "fire truck or ambulance", "fire trucks and ambulances")} sold
          at public auction
          {sales.firstYear && sales.lastYear
            ? ` between ${sales.firstYear} and ${sales.lastYear}`
            : ""}
          .{" "}
          {medianAll !== null
            ? `Half sold for ${formatMoney(medianAll)} or less, which matters for the sale rules below. `
            : ""}
          Age is the sale year minus the model year in the lot title.
        </p>
        <div className="max-w-3xl">
          <PriceByAgeChart buckets={buckets} />
        </div>
        <p className="max-w-3xl text-sm text-as-ink-2">
          Only confirmed sale prices count.
          {sales.notSold
            ? ` ${plural(sales.notSold, "lot")} with only the last bid seen, not a sale price, ${sales.notSold === 1 ? "is" : "are"} left out.`
            : ""}
          {sales.noYear
            ? ` ${plural(sales.noYear, "lot")} with no model year ${sales.noYear === 1 ? "is" : "are"} left off the chart.`
            : ""}
        </p>
        <details>
          <summary className="cursor-pointer text-as-link">The chart as a table</summary>
          <table className="data-table mt-2 text-sm">
            <caption className="sr-only">Sale price by truck age</caption>
            <thead>
              <tr>
                <th scope="col">Age at sale</th>
                <th scope="col" className="r">
                  Lots
                </th>
                <th scope="col" className="r">
                  Median
                </th>
                <th scope="col" className="r">
                  Middle half
                </th>
                <th scope="col" className="r">
                  Lowest
                </th>
                <th scope="col" className="r">
                  Highest
                </th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.label}>
                  <td className="font-semibold">{b.label}</td>
                  <td className="r" data-label="Lots">
                    {formatNumber(b.count)}
                  </td>
                  <td className="r" data-label="Median">
                    {formatMoney(b.median)}
                  </td>
                  <td className="r whitespace-nowrap" data-label="Middle half">
                    {formatMoney(b.p25)} to {formatMoney(b.p75)}
                  </td>
                  <td className="r" data-label="Lowest">
                    {formatMoney(b.low)}
                  </td>
                  <td className="r" data-label="Highest">
                    {formatMoney(b.high)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <details>
          <summary className="cursor-pointer text-as-link">Where the lots were sold</summary>
          <table className="data-table mt-2 max-w-md text-sm">
            <caption className="sr-only">Closed sales by state</caption>
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col" className="r">
                  Lots
                </th>
              </tr>
            </thead>
            <tbody>
              {byState.map((r) => (
                <tr key={r.state ?? "none"}>
                  <td>
                    {r.state === null
                      ? "State not given"
                      : (getState(r.state)?.name ?? r.state)}
                  </td>
                  <td className="r" data-label="Lots">
                    {formatNumber(r.count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section aria-labelledby="rules" className="space-y-4">
        <h2 id="rules" className="text-xl font-semibold">
          State sale rules
        </h2>
        {ruleStates.length ? (
          ruleStates.map((s) => (
            <div key={s.code}>
              <h3 className="mb-2 font-semibold">
                <Link href={`${BASE}/${s.code.toLowerCase()}`}>{s.name}</Link>
              </h3>
              <RuleBox state={s} rule={s.rule ?? method.rules[s.code] ?? null} />
            </div>
          ))
        ) : (
          <p>No state sale rules are written up yet.</p>
        )}
        <p className="text-as-ink-2">Other states are not written up yet.</p>
      </section>

      <section aria-labelledby="limits" className="prose-plain max-w-3xl">
        <h2 id="limits" className="mb-3 text-xl font-semibold">
          Limits
        </h2>
        <p>
          Only one auction site, Auctions International, is read, by hand, and only for the
          Northeast. Trucks listed on other sites are missed.
        </p>
        <p>
          Bids and auction dates are as of the run date. A bid shown here has likely gone up, and an
          auction may have closed.
        </p>
        <p>
          A truck a board voted surplus in the spring may already be sold. The vote is public; the
          sale often is not.
        </p>
        <p>
          A federal grant names the department, not the old truck it replaces, and a new truck can
          take two or three years to arrive.
        </p>
        <p>
          Names in grants and news do not always match the federal registry. Where a match was not
          sure, the lead keeps the source&rsquo;s name and has no registry id.
        </p>
      </section>

      <section aria-labelledby="fifty" className="max-w-3xl">
        <h2 id="fifty" className="mb-3 text-xl font-semibold">
          What a 50-state run needs
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold">Auction sites.</span> GovDeals, TruckPaper, Municibid and
            PublicSurplus refuse scripts. Reading them needs their leave, a data deal, or a person.
          </li>
          <li>
            <span className="font-semibold">Legal notices in each state.</span> Sale and bond notices
            run in local papers and state notice sites, each in its own format.
          </li>
          <li>
            <span className="font-semibold">Board agendas and minutes.</span> Votes to sell or buy a
            truck appear here first, months before a listing.
          </li>
          <li>
            <span className="font-semibold">The yearly FEMA grant file.</span> The awards site refuses
            scripts, so a person downloads the file by hand each year.
          </li>
          <li>
            <span className="font-semibold">A person for name matches.</span> Grants and news name
            towns, districts and companies in many ways; someone has to check each match against the
            registry.
          </li>
        </ul>
      </section>
    </div>
  );
}
