import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { BASE } from "@/apparatus-signals/lib/site";
import { allLeads, getMeta, getMethod, getSales, getState, getStates } from "@/apparatus-signals/lib/data";
import type { PriceGuideRow } from "@/apparatus-signals/lib/data";
import {
  capitalize,
  formatDate,
  formatMoney,
  formatNumber,
  joinPlain,
  numberWord,
  plural,
  tierLabel,
} from "@/apparatus-signals/lib/format";
import { bandLabel, typePlural } from "@/apparatus-signals/lib/trucks";
import { ageBuckets, lotsByState, medianPrice, splitSales } from "@/apparatus-signals/lib/sales";
import {
  BASIS_LABEL,
  BASIS_LEGEND,
  VERDICT_LABELS,
  WEEK_RULE,
  fillTemplate,
  kindLabel,
  modifierLabel,
  windowExample,
  windowSpan,
} from "@/apparatus-signals/lib/words";
import { LeadTimeChart, PriceByAgeChart } from "@/apparatus-signals/ui/charts";
import DoesItWork from "@/apparatus-signals/ui/DoesItWork";
import Ext from "@/apparatus-signals/ui/Ext";
import { RuleBox } from "@/apparatus-signals/ui/StateBits";

/** The age band the method page uses to compare auction and dealer prices. */
const GAP_BAND = "21-25";

/** The auction guide and the dealer asks share one table shape; `count` is "Sales" or "Listings". */
function PriceTable({
  caption,
  rows,
  count,
  median,
}: {
  caption: string;
  rows: PriceGuideRow[];
  count: string;
  median: string;
}) {
  return (
    <table className="data-table">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Truck type</th>
          <th scope="col">Age</th>
          <th scope="col" className="r">
            {count}
          </th>
          <th scope="col" className="r">
            {median}
          </th>
          <th scope="col" className="r">
            Middle half
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.type}-${r.band}`} className={r.thin ? "text-as-muted" : ""}>
            <td className={r.band === "all ages" ? "font-semibold" : ""}>{typePlural(r.type)}</td>
            <td data-label="Age">{bandLabel(r.band)}</td>
            <td className="r" data-label={count}>
              {formatNumber(r.n)}
              {r.thin ? <span className="block text-xs">{`few ${count.toLowerCase()}`}</span> : null}
            </td>
            <td className="r" data-label={median}>
              {formatMoney(r.median)}
            </td>
            <td className="r whitespace-nowrap" data-label="Middle half">
              {formatMoney(r.p25)} to {formatMoney(r.p75)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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
  const leads = allLeads();
  const kinds = Object.keys(method.points).sort(
    (a, b) => method.points[b] - method.points[a] || a.localeCompare(b),
  );
  const tiers = [...method.tiers].sort((a, b) => b.floor - a.floor);
  const guide = method.price_guide;
  const asks = method.ask_guide;
  const pumperRow = (table: PriceGuideRow[]) =>
    table.find((r) => r.type === "pumper" && r.band === GAP_BAND);
  const auctionPumper = pumperRow(guide.table);
  const dealerPumper = pumperRow(asks.table);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-3xl font-semibold">Method</h1>
        <p className="mt-2 max-w-3xl text-lg text-as-ink-2">
          A lead is a department with a public record that says it will sell a truck. Each record
          gets points; we add them up.
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

      <section aria-labelledby="price-guide" className="space-y-4">
        <h2 id="price-guide" className="text-xl font-semibold">
          The price guide
        </h2>
        <p className="max-w-3xl">
          Each lead with a known truck type gets a guide price: the median sale price of trucks of
          that type and age at auction. It uses {formatNumber(guide.meta.lots_used)} of{" "}
          {formatNumber(guide.meta.lots_sold)} sold lots and leaves out{" "}
          {formatNumber(guide.meta.lots_dropped)} as {guide.meta.dropped_why}. Age is the{" "}
          {guide.meta.age}. Source: {guide.meta.source}; built {formatDate(guide.meta.built)}.
        </p>
        <p className="max-w-3xl">
          If the record names the old truck, we use that. If it names only the new one, we assume
          like for like: a department buying a pumper is selling a pumper. With no type, there is
          no guide price; with no model year, the price covers all ages.
        </p>
        <PriceTable
          caption="Auction sale prices by truck type and age"
          rows={guide.table}
          count="Sales"
          median="Median"
        />
        <ul className="max-w-3xl list-disc space-y-1 pl-5 text-sm text-as-ink-2">
          {guide.meta.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dealer-asks" className="space-y-4">
        <h2 id="dealer-asks" className="text-xl font-semibold">
          What dealers ask
        </h2>
        <p className="max-w-3xl">
          Beside each guide price the site shows what dealers ask for a truck of that type and age.
          It uses {formatNumber(asks.meta.listings_used)} priced listings read from{" "}
          {asks.meta.dealers.map((d, i) => (
            <Fragment key={d.name}>
              {i === 0 ? "" : i === asks.meta.dealers.length - 1 ? " and " : ", "}
              <Ext href={d.url}>{d.name}</Ext> ({formatNumber(d.used)} of {formatNumber(d.listings)}
              {i === 0 ? " listings" : ""})
            </Fragment>
          ))}{" "}
          on {formatDate(asks.meta.seen)}. It skips the rest: {asks.meta.skipped_why}. Age is the{" "}
          {asks.meta.age}. The bands, the thin rule (under {numberWord(asks.meta.thin_below)}{" "}
          listings) and the use of the median are the same as in the price guide, so the two tables
          read side by side.
        </p>
        <p className="max-w-3xl">
          Dealer stock runs younger than auction stock, and asks fall with age where auction prices
          barely move. So when a lead&apos;s model year is unknown, the ask is not the all-ages row
          but the row at the usual age of that type at auction (the median age of its sold lots:{" "}
          {joinPlain(Object.entries(asks.usual_age).map(([t, a]) => `${typePlural(t)} ${a}`))}).
          The department page says so on those leads.
        </p>
        {auctionPumper && dealerPumper ? (
          <p className="max-w-3xl">
            The gap is the point. At auction a pumper {bandLabel(GAP_BAND)} sells for about{" "}
            <span className="num">{formatMoney(auctionPumper.median)}</span>; dealers list one for
            about <span className="num">{formatMoney(dealerPumper.median)}</span>. Auction lots
            sell as-is to the high bidder in a few weeks; dealer trucks are usually serviced and
            wait for a buyer.
          </p>
        ) : null}
        <PriceTable
          caption="Dealer asking prices by truck type and age"
          rows={asks.table}
          count="Listings"
          median="Asking median"
        />
        <ul className="max-w-3xl list-disc space-y-1 pl-5 text-sm text-as-ink-2">
          {asks.meta.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="scoring" className="space-y-6">
        <h2 id="scoring" className="text-xl font-semibold">
          Scoring
        </h2>
        <p className="max-w-3xl">
          Each signal earns points for its kind, plus or minus the modifiers that apply to it. A
          department&rsquo;s score is its strongest signal in full plus half of the best signal of
          each other kind. The score sets when to call. {WEEK_RULE} A lead with nothing seen yet
          tops out at &ldquo;Call this month&rdquo;.
        </p>
        <p id="basis" className="max-w-3xl text-as-ink-2">
          {BASIS_LEGEND}
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
                    {k === "new_truck_arrived" ? " (expected from a trade-press delivery column)" : ""}
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

      <section aria-labelledby="listing-window" className="space-y-3">
        <h2 id="listing-window" className="text-xl font-semibold">
          How the listing window is set
        </h2>
        <table className="data-table">
          <caption className="sr-only">Listing window by signal</caption>
          <thead>
            <tr>
              <th scope="col">Signal</th>
              <th scope="col">Window</th>
              <th scope="col">How</th>
              <th scope="col" className="r">
                Cases
              </th>
            </tr>
          </thead>
          <tbody>
            {(method.window ?? []).map((w) => {
              const example = windowExample(w, leads);
              return (
                <tr key={`${w.kinds.join(",")}:${w.anchor ?? ""}:${w.where ?? ""}`}>
                  <td className="font-semibold">
                    {joinPlain(w.kinds.map((k) => kindLabel(k, method)), "or")}
                    {w.where === "trade press" ? " (trade-press delivery column)" : ""}
                  </td>
                  <td data-label="Window">{windowSpan(w)}</td>
                  <td data-label="How">
                    {example ? `e.g. ${example}` : capitalize(fillTemplate(w.how_template))}.
                    {w.how_past_template ? (
                      <div className="text-sm text-as-ink-2">
                        Once past: {fillTemplate(w.how_past_template)}.
                      </div>
                    ) : null}
                  </td>
                  <td className="r" data-label="Cases">
                    {w.n_cases > 0 ? formatNumber(w.n_cases) : "no measured cases yet"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="max-w-3xl text-sm text-as-ink-2">
          A rule of thumb from under 30 measured cases; the method page&rsquo;s{" "}
          <a href="#lead-time">lead-time cases</a> and <a href="#does-it-work">back-test</a> are the
          evidence.
        </p>
      </section>

      <section aria-labelledby="hit-rates" className="space-y-3">
        <h2 id="hit-rates" className="text-xl font-semibold">
          What each signal led to
        </h2>
        <p className="max-w-3xl">Hand counts, small numbers; cases, not rates.</p>
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
          For trucks now at auction, we searched back for the first public mention and counted the
          months to the listing.
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
          <p>We have not looked up any state&rsquo;s sale rules yet.</p>
        )}
        <p className="text-as-ink-2">We have not looked up the other states yet.</p>
      </section>

      <section aria-labelledby="limits" className="prose-plain max-w-3xl">
        <h2 id="limits" className="mb-3 text-xl font-semibold">
          Limits
        </h2>
        <p>
          We read one auction site, Auctions International, by hand, and only for the Northeast. We
          miss trucks listed anywhere else.
        </p>
        <p>
          Bids and auction dates are as of the last refresh. A bid shown here has likely gone up,
          and an auction may have closed.
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
            PublicSurplus refuse scripts. Reading them needs permission, a data deal, or someone
            opening pages by hand.
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
            scripts, so we download the file by hand each year.
          </li>
          <li>
            <span className="font-semibold">Name matches checked by hand.</span> Grants and news name
            towns, districts and companies in many ways; we check each match against the registry.
          </li>
        </ul>
      </section>
    </div>
  );
}
