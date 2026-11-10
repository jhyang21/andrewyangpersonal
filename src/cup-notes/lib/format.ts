// Formatting helpers. Pure functions, safe on server and client. Copied rather than imported from
// the Apparatus Signals microsite so the two stay independent.

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const whole = (v: number) => `${Math.round(v)}`;
export const pct = (v: number) => `${Math.round(v)}%`;
export const secs = (v: number) => `${v.toFixed(1)} s`;

export const usd = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-29" (or an ISO timestamp) -> "29 Oct 2026". */
export function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : value;
}

const intFmt = new Intl.NumberFormat("en-US");

export function formatNumber(n: number): string {
  return intFmt.format(n);
}
