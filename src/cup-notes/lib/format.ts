// Formatting helpers. Pure functions, safe on server and client. Copied rather than imported from
// the Apparatus Signals microsite so the two stay independent.

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const whole = (v: number) => `${Math.round(v)}`;
export const pct = (v: number) => `${Math.round(v)}%`;
export const secs = (v: number) => `${v.toFixed(1)} s`;

export const usd = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-29" (or an ISO timestamp) -> "29 Oct 2026". Returns "" for empty input. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : value;
}

const intFmt = new Intl.NumberFormat("en-US");

export function formatNumber(n: number): string {
  return intFmt.format(n);
}

/** Join words in plain English: "a", "a and b", "a, b and c". */
export function joinPlain(items: string[], word = "and"): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${word} ${items[items.length - 1]}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}
