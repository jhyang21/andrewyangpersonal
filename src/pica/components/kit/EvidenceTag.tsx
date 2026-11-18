import { ChevronDown, CircleDashed, Feather, FileText, Store, type LucideIcon } from "lucide-react";
import type { EvidenceBasis } from "@/pica/lib/types";
import { cn } from "./cn";

/**
 * The four source kinds. The words and icons are fixed by the brief
 * (section 6.5) and stay the same everywhere in the app.
 */
export const EVIDENCE: Record<EvidenceBasis, { icon: LucideIcon; label: string; heading: string }> = {
  merchant: { icon: Store, label: "Merchant says", heading: "Merchant says" },
  catalog_summary: { icon: FileText, label: "From the listing", heading: "From the listing, summarized by Shopify" },
  inference: { icon: Feather, label: "Pica's read", heading: "Pica's read" },
  missing: { icon: CircleDashed, label: "Not verified", heading: "Not verified" },
};

/** In the order the evidence sheet lists them. */
export const EVIDENCE_KINDS: EvidenceBasis[] = ["merchant", "catalog_summary", "inference", "missing"];

/** The tag's words, for use outside the tag (a legend, a list). */
export function evidenceLabel(basis: EvidenceBasis): string {
  return EVIDENCE[basis].label;
}

/** The evidence sheet's section heading; the listing's spells out who wrote the summary. */
export function evidenceHeading(basis: EvidenceBasis): string {
  return EVIDENCE[basis].heading;
}

export interface EvidenceTagProps {
  basis: EvidenceBasis;
  /**
   * Makes the tag a button that opens a quote beneath it (Compare cells).
   * Give it only when a checked quote stands behind the claim.
   */
  onToggle?: () => void;
  /** Whether the quote is open. Needs `onToggle`. */
  expanded?: boolean;
  /** The id of the quote it opens. */
  controls?: string;
  className?: string;
}

const LOOK = "inline-flex min-h-6 max-w-full items-center gap-1 rounded-pill px-2 py-0.5 text-caption font-medium text-ink";

/**
 * Says where a claim comes from. The four kinds differ by icon and words;
 * "Not verified" also gets a dashed outline.
 */
export function EvidenceTag({ basis, onToggle, expanded = false, controls, className }: EvidenceTagProps) {
  const { icon: Icon, label } = EVIDENCE[basis];
  const fill = basis === "missing" ? "border border-dashed border-ink-muted bg-surface" : "bg-canvas";
  const body = (
    <>
      <Icon aria-hidden size={14} className="shrink-0" />
      <span>{label}</span>
    </>
  );

  if (onToggle) {
    return (
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={controls}
        onClick={onToggle}
        className={cn(
          LOOK,
          fill,
          // 24px tall plus 10px above and below: a 44px hit area.
          "relative before:absolute before:inset-x-0 before:-inset-y-2.5",
          "hover:underline underline-offset-2",
          className,
        )}
      >
        {body}
        {/* aria-expanded says open or closed; this says what opens. */}
        <span className="sr-only">, quote</span>
        <ChevronDown
          aria-hidden
          size={14}
          className={cn(
            "shrink-0 transition-transform duration-(--duration-fast) ease-out-soft",
            expanded && "rotate-180",
          )}
        />
      </button>
    );
  }

  return <span className={cn(LOOK, fill, className)}>{body}</span>;
}
