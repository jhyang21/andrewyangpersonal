import type { Metadata } from "next";
import Link from "next/link";
import { BASE } from "@/apparatus-signals/lib/site";
import { notFound } from "next/navigation";
import {
  getDepartment,
  getDepartments,
  getMethod,
  getState,
  getStates,
  runMonth,
  signalsFor,
  type Department,
  type Signal,
} from "@/apparatus-signals/lib/data";
import {
  capitalize,
  formatDate,
  formatMoney,
  formatScore,
  formatWindow,
  lowerFirst,
  numberWord,
  plural,
  tierLabel,
  websiteHref,
  websiteText,
} from "@/apparatus-signals/lib/format";
import { NAMED, bandLabel, typePlural } from "@/apparatus-signals/lib/trucks";
import {
  READ_BY_LABEL,
  VERDICT_LABELS,
  checkedLabel,
  hitRatesFor,
  isOpenStage,
  kindLabel,
  leadTimeCasesFor,
} from "@/apparatus-signals/lib/words";
import BasisBadge from "@/apparatus-signals/ui/Basis";
import Ext from "@/apparatus-signals/ui/Ext";
import { RuleBox } from "@/apparatus-signals/ui/StateBits";
import Timeline from "@/apparatus-signals/ui/Timeline";

export function generateStaticParams() {
  return getStates().flatMap((s) =>
    getDepartments(s.code).map((d) => ({ state: s.code.toLowerCase(), id: d.id })),
  );
}

function load(code: string, rawId: string) {
  const state = getState(code);
  if (!state || code !== code.toLowerCase()) return null;
  const id = decodeURIComponent(rawId);
  const dept = getDepartment(state.code, id);
  return dept ? { state, dept } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; id: string }> }): Promise<Metadata> {
  const { state: code, id } = await params;
  const found = load(code, id);
  if (!found) return { title: "Department not found" };
  return {
    title: `${found.dept.department}, ${found.state.name}`,
    description: `${found.dept.why_call}. ${found.dept.detail}`.slice(0, 200),
  };
}

/** The heading above already says like for like, so the type_how tail would repeat it. */
const LIKE_FOR_LIKE = /;\s*departments usually replace like with like\.?$/;

/** The "When it should list" line, from the lead's stage and window, against the run month. */
function whenLine(dept: Department, signals: Signal[], month: string): string {
  if (dept.stage === "sold") {
    if (dept.top_kind === "bids_closed") return "Bids closed; we have not found the result.";
    if (dept.top_kind === "direct_sale") return "Going direct to a buyer; it will not list.";
    return "Already sold.";
  }
  if (dept.stage === "gear") return "No truck to list: it is selling gear.";
  if (dept.stage === "listed") {
    const closes = signals
      .filter((s) => s.kind === "auction_open" && s.date)
      .map((s) => s.date as string)
      .sort()
      .pop();
    return closes ? `At auction now; closes ${formatDate(closes)}.` : "At auction now.";
  }
  if (!dept.window) return "No window for this kind of signal.";
  const how = dept.window.how ? ` ${capitalize(dept.window.how.replace(/\.$/, ""))}.` : "";
  const passed = dept.window.to < month;
  return `${passed ? "Was due" : "Likely"} ${formatWindow(dept.window)}.${how}`;
}

function TruckSection({ dept }: { dept: Department }) {
  const { truck, guide, ask } = dept;
  // A direct sale has no truck for sale; the pipeline blanks it on purpose.
  const direct = dept.top_kind === "direct_sale";
  const known = !direct && Boolean(truck.description || truck.type);
  let year = "";
  if (truck.year && truck.year_how === "stated") year = ` Model year ${truck.year}.`;
  if (truck.year && truck.year_how === "from age") {
    year = ` Model year about ${truck.year}, worked out from the age the record gives.`;
  }
  return (
    <section aria-labelledby="truck-title" className="rounded border border-as-rule p-4">
      <h2 id="truck-title" className="eyebrow">
        The truck
      </h2>
      {!known ? (
        <p className="mt-1 max-w-3xl text-as-ink-2">
          {direct
            ? "The truck goes to the buyer; nothing is for sale."
            : "The record does not name the old truck."}
        </p>
      ) : (
        <>
          <p className="mt-1 text-lg font-semibold">
            {truck.description ||
              `Probably ${/^[aeiou]/i.test(truck.type ?? "") ? "an" : "a"} ${truck.type}: the new truck is one.`}
          </p>
          <p className="mt-1 max-w-3xl text-sm text-as-ink-2">
            {truck.description
              ? truck.type_how === NAMED
                ? "The record names this truck."
                : "The record names this truck but not its type."
              : ""}
            {truck.type_how && truck.type_how !== NAMED
              ? `${truck.description ? " " : ""}${capitalize(truck.type_how.replace(LIKE_FOR_LIKE, ""))}.`
              : ""}
            {year}
          </p>
          {guide ? (
            <>
              <p className="mt-3 max-w-3xl">
                Trucks like it sold at auction for{" "}
                <span className="num font-semibold">{formatMoney(guide.median)}</span> (
                {plural(guide.n, "sale")} of {typePlural(guide.type)}, {bandLabel(guide.band)}; half
                sold between <span className="num">{formatMoney(guide.p25)}</span> and{" "}
                <span className="num">{formatMoney(guide.p75)}</span>).
                {guide.thin ? " Thin data; do not quote this number." : ""}
              </p>
              {ask ? (
                <p className="mt-3 max-w-3xl">
                  Dealers list {typePlural(guide.type)}, {bandLabel(ask.band)}, for about{" "}
                  <span className="num font-semibold">{formatMoney(ask.median)}</span> (
                  {plural(ask.n, "listing")}; half between{" "}
                  <span className="num">{formatMoney(ask.p25)}</span> and{" "}
                  <span className="num">{formatMoney(ask.p75)}</span>). That is an asking price for a
                  serviced truck, not a sale.
                  {ask.thin ? " Thin data; do not quote this number." : ""}
                </p>
              ) : null}
              {guide.comps.length ? (
                <div className="mt-3">
                  <p className="text-sm text-as-muted">Closest sales:</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {guide.comps.map((c, i) => (
                      <li key={`${i}-${c.url}`}>
                        <Ext href={c.url}>{c.item}</Ext>:{" "}
                        <span className="num">{formatMoney(c.price)}</span>, {formatDate(c.date)}
                        {c.state ? `, ${c.state}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-3 max-w-3xl text-as-ink-2">
              {truck.type
                ? "No guide price for this kind of truck."
                : "No guide price: the truck type is not known."}
            </p>
          )}
        </>
      )}
      <p className="mt-3 text-sm">
        <Link href={`${BASE}/method#price-guide`}>How the guide works</Link>
        {" · "}
        <Link href={`${BASE}/method#dealer-asks`}>How the dealer asks work</Link>
      </p>
    </section>
  );
}

export default async function DepartmentPage({ params }: { params: Promise<{ state: string; id: string }> }) {
  const { state: code, id } = await params;
  const found = load(code, id);
  if (!found) notFound();
  const { state, dept } = found;
  const method = getMethod();
  const signals = signalsFor(state.code, dept);
  const rule = state.rule ?? method.rules[state.code] ?? null;
  const hitRates = hitRatesFor(dept.top_kind, method);
  const cases = leadTimeCasesFor(dept.top_kind, method);
  const place = [dept.city, dept.county ? `${dept.county} County` : "", state.name]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href={BASE}>All states</Link> <span className="text-as-muted">/</span>{" "}
        <Link href={`${BASE}/${state.code.toLowerCase()}`}>{state.name}</Link>{" "}
        <span className="text-as-muted">/</span> <span aria-current="page">{dept.department}</span>
      </nav>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">{dept.department}</h1>
        <p className="text-as-ink-2">
          {[dept.type ? `${dept.type} department` : "", place].filter(Boolean).join(" · ")}
        </p>
        {dept.registry_name && dept.registry_name !== dept.department ? (
          <p className="text-sm text-as-muted">Registry name: {dept.registry_name}</p>
        ) : null}
        {!dept.fdid ? (
          <p className="text-sm text-as-muted">
            Not in the USFA registry; the name is as the source gave it.
          </p>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-as-muted">Website</dt>
          <dd className="break-words">
            {dept.fdid && dept.website ? (
              <Ext href={websiteHref(dept.website)}>{websiteText(dept.website)}</Ext>
            ) : (
              "No website on file."
            )}
          </dd>
          {dept.ask_for ? (
            <>
              <dt className="text-as-muted">Ask for</dt>
              <dd>{dept.ask_for}</dd>
            </>
          ) : null}
        </dl>
        <p>
          <span className="font-semibold">When it should list:</span> {whenLine(dept, signals, runMonth())}
        </p>
      </header>

      <section aria-labelledby="lead-title" className="rounded border border-as-rule p-4">
        <h2 id="lead-title" className="eyebrow">
          The lead
        </h2>
        <p className="mt-1 text-lg font-semibold">
          {!isOpenStage(dept.stage)
            ? kindLabel(dept.top_kind, method)
            : `${tierLabel(dept.tier)}: ${dept.why_call}`}{" "}
          <BasisBadge basis={dept.basis} />
        </p>
        {dept.detail ? <p>{dept.detail}</p> : null}
        <p className="mt-1 text-sm text-as-ink-2">
          Score <span className="num">{formatScore(dept.score)}</span>
          {dept.openRank !== null ? ` · rank ${dept.openRank} in ${state.name}` : ""}
          {dept.signal_date ? ` · ${formatDate(dept.signal_date)}` : ""} ·{" "}
          {READ_BY_LABEL[dept.read_by].toLowerCase()}
          {dept.checked ? ` · ${lowerFirst(checkedLabel(dept.checked))}` : ""}
        </p>
        <p className="mt-1 text-sm">
          <Link href={`${BASE}/method#basis`}>What &ldquo;seen&rdquo; and &ldquo;expected&rdquo; mean</Link>
        </p>
      </section>

      <TruckSection dept={dept} />

      <section aria-labelledby="timeline-title">
        <h2 id="timeline-title" className="mb-3 text-xl font-semibold">
          Signals, oldest first
        </h2>
        {signals.length ? (
          <Timeline signals={signals} method={method} />
        ) : (
          <p className="text-as-ink-2">No signals on file.</p>
        )}
      </section>

      <section aria-labelledby="next-title" className="space-y-3">
        <h2 id="next-title" className="text-xl font-semibold">
          What this usually leads to
        </h2>
        {hitRates.length === 0 && cases.length === 0 ? (
          <p className="text-as-ink-2">
            We have not tracked what happens after &ldquo;
            {lowerFirst(kindLabel(dept.top_kind, method))}&rdquo;.
          </p>
        ) : (
          <>
            {hitRates.map((h) => (
              <div key={h.signal}>
                <p className="font-semibold">{h.signal}</p>
                <p>{h.next}</p>
                <p className="text-sm text-as-muted">
                  {h.state === state.code
                    ? `${capitalize(numberWord(h.found))} ${state.name} ${h.found === 1 ? "department" : "departments"} had this signal (counted ${formatDate(h.as_of)}).`
                    : `We only have ${getState(h.state)?.name ?? h.state} numbers for this.`}
                </p>
              </div>
            ))}
            {cases.length ? (
              <div>
                <p className="font-semibold">Trucks that went to auction after a sign like this</p>
                <ul className="mt-1 space-y-2">
                  {cases.map((c) => (
                    <li key={`${c.seller}-${c.truck}`}>
                      {c.seller}: {c.truck}.{" "}
                      {c.months_before_listing !== null
                        ? `Listed ${c.months_before_listing} months after the first sign.`
                        : "Could not date the first sign."}
                      {c.verdict !== "trace_found" ? (
                        <span className="text-as-muted"> ({VERDICT_LABELS[c.verdict] ?? c.verdict})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-sm">
              <Link href={`${BASE}/method#hit-rates`}>How these were measured</Link>
            </p>
          </>
        )}
      </section>

      <RuleBox state={state} rule={rule} />
    </div>
  );
}
