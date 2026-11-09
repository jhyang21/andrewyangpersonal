// Small hand-rolled charts for /method. Every chart here has a table twin.
import type { LeadTimeCase } from "@/apparatus-signals/lib/data";
import { formatMoney, plural } from "@/apparatus-signals/lib/format";
import type { AgeBucket } from "@/apparatus-signals/lib/sales";

function niceCeil(n: number, step: number): number {
  return Math.max(step, Math.ceil(n / step) * step);
}

/** Months from the first sign to the auction listing, one row per case. */
export function LeadTimeChart({ cases }: { cases: LeadTimeCase[] }) {
  const known = cases.map((c) => c.months_before_listing).filter((m): m is number => m !== null);
  const max = niceCeil(Math.max(1, ...known), 3);
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += 3) ticks.push(t);
  const x = (m: number) => `${(m / max) * 100}%`;

  return (
    <table className="chart w-full border-collapse text-sm">
      <caption className="pb-2 text-left font-semibold">
        Months between the first sign and the auction listing
      </caption>
      <thead>
        <tr>
          <th scope="col" className="w-2/5 pb-1 pr-3 text-left font-normal text-as-ink-2 sm:w-1/3">
            Seller
          </th>
          <th scope="col" className="pb-1 font-normal">
            <span className="sr-only">Months before listing</span>
            <svg width="100%" height="18" aria-hidden="true" focusable="false" overflow="visible">
              {ticks.map((t) => (
                <text
                  key={t}
                  x={x(t)}
                  y="12"
                  textAnchor={t === 0 ? "start" : t === max ? "end" : "middle"}
                >
                  {t}
                </text>
              ))}
            </svg>
          </th>
          <th scope="col" className="w-20 pb-1 pl-2 text-right font-normal text-as-ink-2">
            Months
          </th>
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => {
          const m = c.months_before_listing;
          return (
            <tr key={`${c.seller}-${c.truck}`} className="border-t border-as-rule">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                {c.seller}
              </th>
              <td className="py-1.5">
                <svg width="100%" height="20" aria-hidden="true" focusable="false" overflow="visible">
                  {ticks.map((t) => (
                    <line key={t} className="grid" x1={x(t)} x2={x(t)} y1="0" y2="20" />
                  ))}
                  {m !== null ? (
                    <g>
                      <title>{`${c.seller}: ${m} months`}</title>
                      <line className="line" x1="0" x2={x(m)} y1="10" y2="10" />
                      <circle className="dot ring" cx={x(m)} cy="10" r="5" />
                    </g>
                  ) : (
                    <text x="0" y="14">
                      no date
                    </text>
                  )}
                </svg>
              </td>
              <td className="num py-1.5 pl-2 text-right">{m === null ? "–" : m.toFixed(1)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Sale price by truck age: thin line = 10th to 90th percentile, bar = middle half, mark = median. */
export function PriceByAgeChart({ buckets }: { buckets: AgeBucket[] }) {
  if (buckets.length === 0) return null;
  const top = Math.max(...buckets.map((b) => b.p90));
  const step = top > 40000 ? 10000 : 5000;
  const max = niceCeil(top, step);
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  const x = (v: number) => `${(Math.min(v, max) / max) * 100}%`;
  const w = (a: number, b: number) => `${((Math.min(b, max) - Math.min(a, max)) / max) * 100}%`;
  const compact = (v: number) => (v === 0 ? "$0" : `$${v / 1000}K`);

  return (
    <figure className="chart">
      <table className="w-full border-collapse text-sm">
        <caption className="pb-1 text-left font-semibold">Sale price by truck age</caption>
        <thead>
          <tr>
            <th scope="col" className="w-1/3 pb-1 pr-3 text-left font-normal text-as-ink-2 sm:w-1/4">
              Age at sale
            </th>
            <th scope="col" className="pb-1 font-normal">
              <span className="sr-only">Price spread</span>
              <svg width="100%" height="18" aria-hidden="true" focusable="false" overflow="visible">
                {ticks.map((t, i) => (
                  <text
                    key={t}
                    className={i % 2 ? "minor" : undefined}
                    x={x(t)}
                    y="12"
                    textAnchor={t === 0 ? "start" : t === max ? "end" : "middle"}
                  >
                    {compact(t)}
                  </text>
                ))}
              </svg>
            </th>
            <th scope="col" className="w-20 pb-1 pl-2 text-right font-normal text-as-ink-2">
              Median
            </th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.label} className="border-t border-as-rule">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                {b.label}
                <div className="num text-xs text-as-muted">{plural(b.count, "lot")}</div>
              </th>
              <td className="py-1.5">
                <svg width="100%" height="24" aria-hidden="true" focusable="false" overflow="visible">
                  <title>{`${b.label}: median ${formatMoney(b.median)}, middle half ${formatMoney(b.p25)} to ${formatMoney(b.p75)}`}</title>
                  {ticks.map((t) => (
                    <line key={t} className="grid" x1={x(t)} x2={x(t)} y1="0" y2="24" />
                  ))}
                  <line className="whisker" x1={x(b.p10)} x2={x(b.p90)} y1="12" y2="12" />
                  <rect className="bar" x={x(b.p25)} width={w(b.p25, b.p75)} y="6" height="12" rx="3" />
                  <rect
                    className="mark"
                    x={x(b.median)}
                    width="3"
                    y="2"
                    height="20"
                    transform="translate(-1.5 0)"
                  />
                </svg>
              </td>
              <td className="num py-1.5 pl-2 text-right">{formatMoney(b.median)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="mt-2 text-sm text-as-ink-2">
        Thin line: the middle 8 in 10 sales. Bar: the middle half. Dark mark: the median.
      </figcaption>
    </figure>
  );
}

