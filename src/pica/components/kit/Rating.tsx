import { Star } from "lucide-react";
import type { CatalogProduct } from "@/pica/lib/types";
import { cn } from "./cn";

/** A rating on fewer reviews than this gets a "few reviews" note. */
export const FEW_REVIEWS = 20;

export interface RatingProps {
  /** The catalog rating. Renders nothing when absent. */
  rating?: CatalogProduct["rating"] | null;
  /** Adds "Few reviews so far" when the count is under 20, as the evidence sheet asks. */
  noteFewReviews?: boolean;
  className?: string;
}

/**
 * "4.6 (212)" with a star. Shows what the catalog reports, nothing more.
 * A scale other than 5 shows in the text too: "8.2 / 10 (212)". The count is
 * ink-soft, which passes on white and on canvas.
 */
export function Rating({ rating, noteFewReviews = false, className }: RatingProps) {
  if (!rating || rating.count <= 0) return null;
  const value = rating.value.toFixed(1);
  const count = rating.count.toLocaleString("en-US");
  const reviews = rating.count === 1 ? "review" : "reviews";
  const scale = rating.scaleMax === 5 ? "" : ` / ${rating.scaleMax.toLocaleString("en-US")}`;
  const few = noteFewReviews && rating.count < FEW_REVIEWS;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1 text-caption text-ink", className)}>
      <Star aria-hidden size={14} className="fill-star text-star" />
      <span aria-hidden className="tabular-nums">
        {value}
        {scale} <span className="text-ink-soft">({count})</span>
      </span>
      <span className="sr-only">
        Rated {value} out of {rating.scaleMax}, {count} {reviews}
      </span>
      {few ? <span className="text-ink-soft">· Few reviews so far</span> : null}
    </span>
  );
}
