import type { Metadata } from "next";
import Link from "next/link";
import { BASE } from "@/apparatus-signals/lib/site";
import { notFound, permanentRedirect } from "next/navigation";
import {
  departmentHref,
  getDepartments,
  getMethod,
  getState,
  getStates,
  leadsPer100,
  runMonth,
  signalsFor,
} from "@/apparatus-signals/lib/data";
import { formatNumber, plural } from "@/apparatus-signals/lib/format";
import { guideTotalLine } from "@/apparatus-signals/lib/trucks";
import {
  COVERAGE,
  isDoneStage,
  isOpenStage,
  kindLabel,
  likelyListed,
} from "@/apparatus-signals/lib/words";
import KindBars from "@/apparatus-signals/ui/KindBars";
import LeadTable, { type KindOption, type LeadRow } from "@/apparatus-signals/ui/LeadTable";
import { CoverageCard, RuleBox } from "@/apparatus-signals/ui/StateBits";

export function generateStaticParams() {
  return getStates().map((s) => ({ state: s.code.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state: code } = await params;
  const state = getState(code);
  if (!state) return { title: "State not found" };
  return {
    title: `${state.name} fire departments likely to sell a truck`,
    description: `${plural(state.leads.total, "lead")} in ${state.name}. ${COVERAGE[state.coverage].long}`,
  };
}

export default async function StatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state: code } = await params;
  const state = getState(code);
  if (!state) notFound();
  if (code !== code.toLowerCase()) permanentRedirect(`${BASE}/${code.toLowerCase()}`);

  const method = getMethod();
  const departments = getDepartments(state.code);
  const rule = state.rule ?? method.rules[state.code] ?? null;
  const month = runMonth();

  const rows: LeadRow[] = departments.map((d) => ({
    id: d.id,
    href: departmentHref(state.code, d),
    rank: d.openRank,
    tier: d.tier,
    score: d.score,
    department: d.department,
    city: d.city,
    county: d.county,
    type: d.type,
    why_call: d.why_call,
    detail: d.detail,
    truck: d.truck,
    guide: d.guide,
    signal_date: d.signal_date,
    other_signals: d.other_signals,
    proof_url: d.proof_url,
    proof_quote: d.proof_quote,
    checked: d.checked,
    ask_for: d.ask_for,
    // Only registry websites reach the site; contacts found by hand stay private.
    website: d.fdid ? d.website : "",
    basis: d.basis,
    read_by: d.read_by,
    kinds: [...new Set([d.top_kind, ...signalsFor(state.code, d).map((s) => s.kind)])],
    stage: d.stage,
    top_kind: d.top_kind,
    likely: likelyListed(d, month),
  }));

  const kindSet = new Set(rows.flatMap((r) => r.kinds));
  const kindOptions: KindOption[] = Object.keys(method.labels)
    .filter((k) => kindSet.has(k))
    .concat([...kindSet].filter((k) => !(k in method.labels)))
    .map((k) => ({ kind: k, label: kindLabel(k, method) }));

  const byKind = Object.entries(state.by_kind).map(([kind, count]) => ({
    kind,
    label: kindLabel(kind, method),
    count,
  }));

  // Tier counts cover open leads only; gear and done leads are counted apart.
  const total = departments.length;
  const open = departments.filter((d) => isOpenStage(d.stage));
  const tierCount = (n: string) => open.filter((d) => d.tier.startsWith(n)).length;
  const gear = departments.filter((d) => d.stage === "gear").length;
  const done = departments.filter((d) => isDoneStage(d.stage)).length;
  const extra = [
    gear ? `${plural(gear, "department")} selling gear, no truck named.` : "",
    done ? `${formatNumber(done)} already listed, sold, bids closed or going direct.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href={BASE}>All states</Link> <span className="text-as-muted">/</span>{" "}
        <span aria-current="page">{state.name}</span>
      </nav>

      <header>
        <h1 className="text-3xl font-semibold">{state.name}</h1>
        <p className="mt-2 text-lg text-as-ink-2">
          {total === 0
            ? "No leads this refresh."
            : `${plural(total, "lead")}. Not yet listed: ${formatNumber(tierCount("1"))} to call this week, ${formatNumber(tierCount("2"))} this month, ${formatNumber(tierCount("3"))} to watch.${extra ? ` ${extra}` : ""}`}{" "}
          <span className="num">{leadsPer100(state).toFixed(1)}</span> per 100 departments.
        </p>
      </header>

      <div className="space-y-2">
        <CoverageCard state={state} method={method} />
        {total > 0 ? (
          <p className="max-w-3xl text-sm text-as-ink-2">
            {guideTotalLine(state.guide_total, "on this list")}{" "}
            <Link href={`${BASE}/method#price-guide`}>How the guide works</Link>
          </p>
        ) : null}
      </div>

      {total === 0 ? (
        <section aria-labelledby="none-title">
          <h2 id="none-title" className="text-xl font-semibold">
            No leads yet
          </h2>
          <p className="mt-1 max-w-3xl">
            Nothing turned up for {state.name} this refresh. We have not read its minutes, so read
            nothing into that.
          </p>
        </section>
      ) : (
        <>
          <section aria-labelledby="leads-title">
            <h2 id="leads-title" className="mb-3 text-xl font-semibold">
              Leads
            </h2>
            <LeadTable rows={rows} kinds={kindOptions} stateName={state.name} />
          </section>
          <section aria-labelledby="kinds-title" className="max-w-2xl">
            <h2 id="kinds-title" className="sr-only">
              Leads by signal
            </h2>
            <KindBars rows={byKind} caption="Leads by their strongest signal" />
          </section>
        </>
      )}

      {rule || state.coverage === "deep" ? <RuleBox state={state} rule={rule} /> : null}
    </div>
  );
}
