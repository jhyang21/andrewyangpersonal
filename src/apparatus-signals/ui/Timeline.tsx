import type { Method, Signal } from "@/apparatus-signals/lib/data";
import { formatDate } from "@/apparatus-signals/lib/format";
import { READ_BY_LABEL, kindLabel } from "@/apparatus-signals/lib/words";
import Ext from "@/apparatus-signals/ui/Ext";

export default function Timeline({ signals, method }: { signals: Signal[]; method: Method }) {
  // Oldest to newest; undated signals go last.
  const sorted = [...signals].sort((a, b) => {
    if (!a.date !== !b.date) return a.date ? -1 : 1;
    return (a.date ?? "").localeCompare(b.date ?? "");
  });
  return (
    <ol className="relative space-y-6 border-l border-as-axis pl-5">
      {sorted.map((s, i) => (
        <li key={`${s.kind}-${s.date}-${i}`} className="relative">
          <span
            aria-hidden="true"
            className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--as-series-1)", boxShadow: "0 0 0 2px var(--as-bg)" }}
          />
          <p className="num text-sm text-as-muted">{formatDate(s.date) || "Date not known"}</p>
          <h3 className="font-semibold">
            {kindLabel(s.kind, method)}{" "}
            <span className="num text-sm font-normal text-as-ink-2">
              +{s.points} {s.points === 1 ? "point" : "points"}
            </span>
          </h3>
          {s.detail ? <p>{s.detail}</p> : null}
          {s.quote ? <blockquote className="quote mt-2 text-sm">{s.quote}</blockquote> : null}
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
            {s.where ? (
              <>
                <dt className="text-as-muted">Where</dt>
                <dd>{s.where}</dd>
              </>
            ) : null}
            {s.checked ? (
              <>
                <dt className="text-as-muted">Checked</dt>
                <dd>{s.checked}</dd>
              </>
            ) : null}
            <dt className="text-as-muted">How read</dt>
            <dd>{READ_BY_LABEL[s.read_by]}</dd>
            {s.source_name ? (
              <>
                <dt className="text-as-muted">Named as</dt>
                <dd>
                  {s.source_name}
                  {s.match ? <span className="text-as-muted"> ({s.match})</span> : null}
                </dd>
              </>
            ) : null}
          </dl>
          {s.url ? (
            <p className="mt-1 text-sm">
              <Ext href={s.url}>Read the source</Ext>
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
