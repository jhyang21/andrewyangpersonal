import type { ReactNode } from "react";
import { cn } from "./cn";

export interface CardProps {
  children: ReactNode;
  /** The element to render. Default `div`. */
  as?: "div" | "section" | "article" | "li";
  /** `none` for a card led by an edge-to-edge image. Default `md` (16). */
  padding?: "none" | "sm" | "md" | "lg";
  /** Adds the card shadow. White on grey gives lift on its own. */
  shadow?: boolean;
  /** The id of the card's heading, to name a section or article by it. */
  "aria-labelledby"?: string;
  className?: string;
}

const PADDING = { none: "", sm: "p-3", md: "p-4", lg: "p-6" } as const;

/** White, radius 28, no border. Sits on the grey canvas. */
export function Card({
  children,
  as: Tag = "div",
  padding = "md",
  shadow = false,
  "aria-labelledby": labelledBy,
  className,
}: CardProps) {
  return (
    <Tag
      aria-labelledby={labelledBy}
      className={cn("rounded-card bg-surface", PADDING[padding], shadow && "shadow-card", className)}
    >
      {children}
    </Tag>
  );
}
