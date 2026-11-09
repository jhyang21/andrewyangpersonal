import type { Basis } from "@/apparatus-signals/lib/data";
import { BASIS_LABEL } from "@/apparatus-signals/lib/words";

/** "Seen" (solid) or "Expected" (dashed) next to a lead. */
export default function BasisBadge({ basis }: { basis: Basis }) {
  const seen = basis === "observed";
  return (
    <span
      className={`inline-block rounded border px-1.5 text-xs whitespace-nowrap ${
        seen ? "border-as-ink font-semibold text-as-ink" : "border-dashed border-as-axis text-as-muted"
      }`}
    >
      {BASIS_LABEL[basis]}
    </span>
  );
}
