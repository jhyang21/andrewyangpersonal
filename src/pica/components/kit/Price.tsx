import type { Money } from "@/pica/lib/types";
import { cn } from "./cn";

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, cents: boolean): Intl.NumberFormat {
  const key = `${currency}:${cents}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      ...(cents ? {} : { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    });
    formatters.set(key, f);
  }
  return f;
}

/** Digits after the point for a currency: 2 for USD, 0 for JPY. */
function minorDigits(currency: string): number {
  return formatter(currency, true).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Format money given in minor units. Whole amounts drop the cents:
 * 12000 USD → "$120", 11999 USD → "$119.99".
 */
export function formatMoney(money: Money): string {
  const digits = minorDigits(money.currency);
  const major = money.amount / 10 ** digits;
  return formatter(money.currency, !Number.isInteger(major)).format(major);
}

/**
 * The second line under a price when other versions of the product cost
 * something else: "Other versions cost $168 to $228". Null when every version
 * costs the shown price, or the currencies differ.
 */
export function otherVersionsText(price: Money, range: { min: Money; max: Money }): string | null {
  const { min, max } = range;
  if (min.currency !== price.currency || max.currency !== price.currency) return null;
  if (min.amount === price.amount && max.amount === price.amount) return null;
  if (min.amount === max.amount) return `Other versions cost ${formatMoney(min)}`;
  return `Other versions cost ${formatMoney(min)} to ${formatMoney(max)}`;
}

export interface PriceProps {
  /** The price of the version shown, plain. */
  price: Money;
  /** Top of a price range. Shown as "$80–$120" when higher than `price`. */
  max?: Money;
  /** The catalog's range across all versions. Adds a second line when it differs from `price`. */
  otherVersions?: { min: Money; max: Money };
  /** `sm` body, `md` body-lg (cards), `lg` heading (Decide). Default `md`. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "text-body",
  md: "text-body-lg",
  lg: "text-heading",
} as const;

/**
 * The one way the app shows a price. It has no struck-through form and no
 * sale mark, even when the catalog gives a list price: a crossed-out price
 * is a nudge.
 */
export function Price({ price, max, otherVersions, size = "md", className }: PriceProps) {
  const isRange = max !== undefined && max.currency === price.currency && max.amount > price.amount;
  const second = otherVersions ? otherVersionsText(price, otherVersions) : null;

  return (
    <span className={cn("inline-flex flex-col text-ink", className)}>
      <span className={cn(SIZES[size], "font-semibold tabular-nums")}>
        {isRange ? (
          <>
            <span className="sr-only">From </span>
            {formatMoney(price)}
            <span aria-hidden>–</span>
            <span className="sr-only"> to </span>
            {formatMoney(max)}
          </>
        ) : (
          formatMoney(price)
        )}
      </span>
      {second ? <span className="text-body text-ink-soft">{second}</span> : null}
    </span>
  );
}
