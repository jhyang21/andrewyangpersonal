"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "./cn";
import { useLand } from "./useLand";

export interface BottomBarItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown once it is above 0. */
  count?: number;
  /** What a screen reader hears for the count, e.g. "4 options". Defaults to the number. */
  countLabel?: string;
}

export interface BottomBarProps {
  items: BottomBarItem[];
  /** The id of the view on screen. */
  current?: string;
  /** The nav's name for screen readers. */
  label?: string;
  /**
   * Hide the bar while any text field on the page has focus, which covers
   * the open phone keyboard (CSS only, no script). The app shell sets this;
   * leave it off where the bar is shown beside fields, as on /kit.
   */
  hideWhileTyping?: boolean;
  className?: string;
}

/**
 * The phone's bottom bar: a `nav` of links, not a tab list. White with
 * shadow-float, padded for the safe area. It does not fix itself in place;
 * the page does that.
 */
export function BottomBar({ items, current, label = "Views", hideWhileTyping = false, className }: BottomBarProps) {
  return (
    <nav
      aria-label={label}
      data-hide-while-typing={hideWhileTyping || undefined}
      className={cn("kit-bottom-bar bg-surface pb-[env(safe-area-inset-bottom)] shadow-float", className)}
    >
      <ul className="flex">
        {items.map((item) => (
          <li key={item.id} className="min-w-0 flex-1">
            <BarLink item={item} current={item.id === current} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function BarLink({ item, current }: { item: BottomBarItem; current: boolean }) {
  const { href, label, icon: Icon, count = 0, countLabel } = item;
  // An option joining the comparison is one of the brief's "lands" moments.
  const countRef = useLand<HTMLSpanElement>(count);
  return (
    // The pill, the padding and the 56px height are in px, so large text grows
    // only the label and the bar stays short (brief 6.2).
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex min-h-[56px] flex-col items-center justify-center gap-[2px] px-[2px] py-[6px] text-caption text-ink",
        current && "font-semibold",
      )}
    >
      <span
        className={cn(
          "relative flex h-[32px] w-[56px] items-center justify-center rounded-pill border-2",
          "transition-colors duration-(--duration-fast) ease-out-soft",
          current ? "border-ink bg-purple-soft" : "border-transparent",
        )}
      >
        <Icon aria-hidden size={20} />
        {count > 0 ? (
          <span
            ref={countRef}
            aria-hidden
            className="absolute -top-[6px] -right-[4px] inline-block min-w-5 rounded-pill bg-ink px-1 text-center text-caption font-semibold text-surface tabular-nums"
          >
            {count}
          </span>
        ) : null}
      </span>
      {/* One line at any text size; at 200% text the longest label, "Compare", still fits a 320px screen's third. */}
      <span className="max-w-full text-center whitespace-nowrap">{label}</span>
      {count > 0 ? <span className="sr-only">, {countLabel ?? count}</span> : null}
    </Link>
  );
}
