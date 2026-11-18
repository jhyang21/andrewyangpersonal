import { cn } from "./cn";

export interface SkeletonProps {
  /** `block` for any box (size it with className), `text` for lines, `circle` for avatars. */
  variant?: "block" | "text" | "circle";
  /** Number of lines for `text`. The last is shorter. Default 3. */
  lines?: number;
  className?: string;
}

// A loading shape is one of the two things allowed to loop; it holds still
// under reduced motion.
const TONE = "motion-safe:animate-pulse bg-hairline";

/**
 * Grey placeholders while content loads. Hidden from screen readers;
 * mark the loading region with `aria-busy` and a status message instead.
 */
export function Skeleton({ variant = "block", lines = 3, className }: SkeletonProps) {
  if (variant === "text") {
    return (
      <div aria-hidden className={cn("flex flex-col gap-2", className)}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={cn(TONE, "h-3.5 rounded-pill", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />
        ))}
      </div>
    );
  }
  return <div aria-hidden className={cn(TONE, variant === "circle" ? "rounded-full" : "rounded-image", className)} />;
}

/** A loading stand-in for a product card: image, name, price. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex flex-col gap-3 rounded-card bg-surface p-3", className)}>
      <Skeleton className="aspect-square w-full" />
      <Skeleton variant="text" lines={2} className="px-1" />
      <Skeleton className="mx-1 h-5 w-16 rounded-pill" />
    </div>
  );
}
