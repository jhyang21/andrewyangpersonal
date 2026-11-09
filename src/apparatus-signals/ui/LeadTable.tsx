"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import {
  formatDate,
  formatNumber,
  formatScore,
  tierLabel,
  tierOrder,
  websiteHref,
  websiteText,
} from "@/apparatus-signals/lib/format";
import type { Basis, ReadBy } from "@/apparatus-signals/lib/data";
import { BASIS_LEGEND, READ_BY_LABEL } from "@/apparatus-signals/lib/words";
import BasisBadge from "@/apparatus-signals/ui/Basis";
import Ext from "@/apparatus-signals/ui/Ext";

export interface LeadRow {
  id: string;
  href: string;
  rank: number;
  tier: string;
  score: number;
  department: string;
  city: string;
  county: string;
  type: string;
  why_call: string;
  detail: string;
  truck_for_sale: string;
  signal_date: string;
  other_signals: string;
  proof_url: string;
  proof_quote: string;
  checked: string;
  ask_for: string;
  website: string;
  basis: Basis;
  read_by: ReadBy;
  /** True when the department has a federal registry id. */
  registered: boolean;
  kinds: string[];
}

export interface KindOption {
  kind: string;
  label: string;
}

type SortKey = "score" | "date";

function place(row: LeadRow): string {
  const county = row.county ? `${row.county} County` : "";
  return [row.city, county].filter(Boolean).join(", ");
}

export default function LeadTable({
  rows,
  kinds,
  stateName,
}: {
  rows: LeadRow[];
  kinds: KindOption[];
  stateName: string;
}) {
  const [sort, setSort] = useState<SortKey>("score");
  const [tier, setTier] = useState("all");
  const [kind, setKind] = useState("all");
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const tiers = useMemo(
    () => [...new Set(rows.map((r) => r.tier))].sort((a, b) => tierOrder(a) - tierOrder(b)),
    [rows],
  );

  const shown = useMemo(() => {
    const out = rows.filter(
      (r) => (tier === "all" || r.tier === tier) && (kind === "all" || r.kinds.includes(kind)),
    );
    if (sort === "score") {
      out.sort((a, b) => b.score - a.score || a.rank - b.rank);
    } else {
      out.sort((a, b) => {
        if (!a.signal_date !== !b.signal_date) return a.signal_date ? -1 : 1;
        return b.signal_date.localeCompare(a.signal_date) || a.rank - b.rank;
      });
    }
    return out;
  }, [rows, tier, kind, sort]);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectCls =
    "mt-1 block w-full rounded border border-as-rule bg-as-bg px-2 py-1.5 text-sm text-as-ink sm:w-auto";

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="text-sm text-as-ink-2">
          Sort by
          <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="score">Score, highest first</option>
            <option value="date">Date, newest first</option>
          </select>
        </label>
        <label className="text-sm text-as-ink-2">
          When to call
          <select className={selectCls} value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="all">All</option>
            {tiers.map((t) => (
              <option key={t} value={t}>
                {tierLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-as-ink-2">
          Signal
          <select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">Any signal</option>
            {kinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-2 text-sm text-as-ink-2" aria-live="polite">
        Showing {formatNumber(shown.length)} of {formatNumber(rows.length)} leads
        in {stateName}.
      </p>
      <p className="mb-2 text-sm text-as-muted">{BASIS_LEGEND}</p>
      <table className="data-table">
        <caption className="sr-only">Leads in {stateName}</caption>
        <thead>
          <tr>
            <th scope="col" className="r">
              #
            </th>
            <th scope="col">Department</th>
            <th scope="col">Why call</th>
            <th scope="col">When</th>
            <th scope="col" className="r">
              Score
            </th>
            <th scope="col">Date</th>
            <th scope="col">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const isOpen = open.has(r.id);
            const panelId = `lead-${r.id}`;
            return (
              <Fragment key={r.id}>
                <tr>
                  <td className="r text-as-muted" data-label="Rank">
                    {r.rank}
                  </td>
                  <td>
                    <Link href={r.href} className="font-semibold">
                      {r.department}
                    </Link>
                    {place(r) ? <div className="text-sm text-as-muted">{place(r)}</div> : null}
                  </td>
                  <td data-label="Why call">
                    {r.why_call}
                    {r.detail ? <div className="text-sm text-as-ink-2">{r.detail}</div> : null}
                  </td>
                  <td data-label="When" className={r.tier.startsWith("1") ? "font-semibold" : ""}>
                    {tierLabel(r.tier)} <BasisBadge basis={r.basis} />
                  </td>
                  <td className="r" data-label="Score">
                    {formatScore(r.score)}
                  </td>
                  <td className="num whitespace-nowrap" data-label="Date">
                    {formatDate(r.signal_date) || "Not known"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="rounded border border-as-rule px-2 py-1 text-sm text-as-link hover:bg-as-bg-2"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => toggle(r.id)}
                    >
                      {isOpen ? "Less" : "More"}
                      <span className="sr-only"> about {r.department}</span>
                    </button>
                  </td>
                </tr>
                <tr id={panelId} hidden={!isOpen}>
                  <td colSpan={7} className="bg-as-bg-2">
                    {isOpen ? <LeadDetail row={r} /> : null}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {shown.length === 0 ? (
        <p className="mt-3 text-as-ink-2">No leads match these filters.</p>
      ) : null}
    </div>
  );
}

function LeadDetail({ row }: { row: LeadRow }) {
  const others = row.other_signals ? row.other_signals.split(" | ").filter(Boolean) : [];
  return (
    <div className="grid gap-3 p-3 text-sm sm:grid-cols-2">
      <div className="space-y-2">
        {row.truck_for_sale ? (
          <p>
            <span className="text-as-muted">Truck: </span>
            {row.truck_for_sale}
          </p>
        ) : null}
        {row.proof_quote ? <blockquote className="quote">{row.proof_quote}</blockquote> : null}
        {row.proof_url ? (
          <p>
            <Ext href={row.proof_url}>Read the source</Ext>
          </p>
        ) : null}
        {row.checked ? (
          <p>
            <span className="text-as-muted">Checked: </span>
            {row.checked}
          </p>
        ) : null}
        {others.length ? (
          <div>
            <p className="text-as-muted">Other signals:</p>
            <ul className="list-disc pl-5">
              {others.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        {row.ask_for ? (
          <p>
            <span className="text-as-muted">Ask for: </span>
            {row.ask_for}
          </p>
        ) : null}
        {row.website ? (
          <p className="break-words">
            <span className="text-as-muted">Website: </span>
            <Ext href={websiteHref(row.website)}>{websiteText(row.website)}</Ext>
          </p>
        ) : null}
        {!row.website ? (
          <p className="text-as-ink-2">
            {row.registered
              ? "The federal registry lists no website."
              : "Not in the federal registry, so no website is shown."}
          </p>
        ) : null}
        {row.type ? (
          <p>
            <span className="text-as-muted">Type: </span>
            {row.type}
          </p>
        ) : null}
        <p className="text-as-muted">{READ_BY_LABEL[row.read_by]}</p>
      </div>
    </div>
  );
}
