"use client";

import { Check, type LucideIcon } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "./cn";
import { rovingIndex } from "./roving";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export interface SegmentedControlProps<T extends string> {
  /** Base id. Tabs get `${id}-tab-${value}`; give each panel `segmentPanelId(id, value)`. */
  id: string;
  /** Screen reader name for the group, such as "Sort". */
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function segmentTabId(id: string, value: string) {
  return `${id}-tab-${value}`;
}

/** Put this id on each panel, with `role="tabpanel"` and `aria-labelledby={segmentTabId(id, value)}`. */
export function segmentPanelId(id: string, value: string) {
  return `${id}-panel-${value}`;
}

/**
 * Switches between panels in place. Tab roles; arrow keys, Home and End move
 * and select. Not for moving between views of a decision: that is BottomBar,
 * a nav of links. The selected segment has a purple-soft fill, a check and a
 * 2px ink edge, never the fill alone.
 */
export function SegmentedControl<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function move(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = rovingIndex(e.key, index, options.length);
    if (next === null) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-pill border border-ink-muted bg-surface p-1",
        className,
      )}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        const Icon = selected ? Check : option.icon;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={segmentTabId(id, option.value)}
            aria-selected={selected}
            aria-controls={segmentPanelId(id, option.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              "inline-flex h-11 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-pill border-2 px-3 text-body whitespace-nowrap",
              "transition-colors duration-(--duration-fast) ease-out-soft",
              selected ? "border-ink bg-purple-soft font-semibold text-ink" : "border-transparent text-ink hover:bg-canvas",
            )}
          >
            {Icon ? <Icon aria-hidden size={16} className="shrink-0" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
