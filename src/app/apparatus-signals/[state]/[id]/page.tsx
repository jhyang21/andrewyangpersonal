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
  signalsFor,
} from "@/apparatus-signals/lib/data";
import {
  formatDate,
  formatScore,
  tierLabel,
  websiteHref,
  websiteText,
} from "@/apparatus-signals/lib/format";
import {
  BASIS_LEGEND,
  COVERAGE,
  READ_BY_LABEL,
  VERDICT_LABELS,
  hitRatesFor,
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
            Not matched to the federal registry, so the name comes from the source and no website is
            shown.
          </p>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {dept.fdid ? (
            <>
              <dt className="text-as-muted">Website</dt>
              <dd className="break-words">
                {dept.website ? (
                  <Ext href={websiteHref(dept.website)}>{websiteText(dept.website)}</Ext>
                ) : (
                  "Not listed"
                )}
              </dd>
            </>
          ) : null}
          {dept.ask_for ? (
            <>
              <dt className="text-as-muted">Ask for</dt>
              <dd>{dept.ask_for}</dd>
            </>
          ) : null}
        </dl>
        {dept.fdid ? (
          <p className="text-xs text-as-muted">
            The website comes from the USFA National Fire Department Registry, a public federal
            database.
          </p>
        ) : null}
      </header>

      <section aria-labelledby="lead-title" className="rounded border border-as-rule p-4">
        <h2 id="lead-title" className="eyebrow">
          The lead
        </h2>
        <p className="mt-1 text-lg font-semibold">
          {tierLabel(dept.tier)}: {dept.why_call} <BasisBadge basis={dept.basis} />
        </p>
        {dept.detail ? <p>{dept.detail}</p> : null}
        <p className="mt-1 text-sm text-as-ink-2">
          Score <span className="num">{formatScore(dept.score)}</span> · rank {dept.rank} in{" "}
          {state.name}
          {dept.signal_date ? ` · ${formatDate(dept.signal_date)}` : ""} · {COVERAGE[state.coverage].name.toLowerCase()}{" "}
          · {READ_BY_LABEL[dept.read_by].toLowerCase()}
        </p>
        <p className="mt-1 text-sm text-as-muted">{BASIS_LEGEND}</p>
      </section>

      <section aria-labelledby="timeline-title">
        <h2 id="timeline-title" className="mb-3 text-xl font-semibold">
          Signals, oldest first
        </h2>
        {signals.length ? (
          <Timeline signals={signals} method={method} />
        ) : (
          <p className="text-as-ink-2">No signal records are linked to this department.</p>
        )}
      </section>

      <section aria-labelledby="next-title" className="space-y-3">
        <h2 id="next-title" className="text-xl font-semibold">
          What this usually leads to
        </h2>
        {hitRates.length === 0 && cases.length === 0 ? (
          <p className="text-as-ink-2">
            There is no track record yet for &ldquo;{kindLabel(dept.top_kind, method).toLowerCase()}
            &rdquo;.
          </p>
        ) : (
          <>
            {hitRates.map((h) => (
              <div key={h.signal}>
                <p className="font-semibold">{h.signal}</p>
                <p>{h.next}</p>
                <p className="text-sm text-as-muted">
                  Found {h.found} in {getState(h.state)?.name ?? h.state}, as of {formatDate(h.as_of)}.
                  {h.state !== state.code ? " Measured where every layer is read, not here." : ""}
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
                        ? `Listed ${c.months_before_listing} months after the first sign`
                        : "No lead time could be dated"}{" "}
                      <span className="text-as-muted">({VERDICT_LABELS[c.verdict] ?? c.verdict})</span>
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
