import { formatNumber } from "@/apparatus-signals/lib/format";

interface KindCount {
  kind: string;
  label: string;
  count: number;
}

/**
 * Leads by signal kind as a ranked bar chart. It is built as a real table
 * (label, bar, count), so the table view and the chart are the same element.
 */
export default function KindBars({ rows, caption }: { rows: KindCount[]; caption: string }) {
  const sorted = rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  if (sorted.length === 0) return null;
  const max = Math.max(...sorted.map((r) => r.count));
  return (
    <table className="chart w-full border-collapse text-sm">
      <caption className="pb-2 text-left font-semibold">{caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Signal</th>
          <th scope="col">Share</th>
          <th scope="col">Leads</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const pct = (r.count / max) * 100;
          return (
            <tr key={r.kind}>
              <th scope="row" className="w-2/5 py-1 pr-3 text-left font-normal text-as-ink-2 sm:w-1/3">
                {r.label}
              </th>
              <td className="py-1" aria-hidden="true">
                <svg width="100%" height="16" role="presentation" focusable="false">
                  <title>{`${r.label}: ${formatNumber(r.count)}`}</title>
                  <rect className="bar" x="0" y="1" width={`${pct}%`} height="14" rx="4" />
                  {/* square the baseline end */}
                  <rect className="bar" x="0" y="1" width={4} height="14" />
                </svg>
              </td>
              <td className="num w-12 py-1 pl-2 text-right">{formatNumber(r.count)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
