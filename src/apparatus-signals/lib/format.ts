// Formatting helpers. Pure functions, safe on server and client.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-08" (or an ISO timestamp) -> "8 Nov 2026". Returns "" for empty input. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  // Sources give a full date, a month ("2026-03") or a year alone.
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?!\d)/.exec(value);
  if (!m) return value;
  if (!m[2]) return m[1];
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return value;
  return m[3] ? `${Number(m[3])} ${month} ${m[1]}` : `${month} ${m[1]}`;
}

/** "2027-04", "2027-07" -> "Apr–Jul 2027"; across a year end -> "Nov 2026–Mar 2027". */
export function formatWindow(w: { from: string; to: string }): string {
  const [fy, fm] = w.from.split("-");
  const [ty, tm] = w.to.split("-");
  const from = MONTHS[Number(fm) - 1];
  const to = MONTHS[Number(tm) - 1];
  if (!from || !to) return `${w.from}–${w.to}`;
  if (w.from === w.to) return `${from} ${fy}`;
  return fy === ty ? `${from}–${to} ${ty}` : `${from} ${fy}–${to} ${ty}`;
}

/**
 * "YYYY-MM" for now. Pages are static, so this is the build month. Call it on
 * the server only, so the client never renders a different month.
 */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** "From FEMA’s table" -> "from FEMA’s table": lowers only a capital followed by a small letter. */
export function lowerFirst(s: string): string {
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

const intFmt = new Intl.NumberFormat("en-US");
const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatNumber(n: number): string {
  return intFmt.format(n);
}

export function formatMoney(n: number): string {
  return moneyFmt.format(n);
}

export function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** "1 Call this week" -> "Call this week". */
export function tierLabel(tier: string): string {
  return tier.replace(/^\s*\d+\s*/, "");
}

/** "1 Call this week" -> 1. Unknown tiers sort last. */
export function tierOrder(tier: string): number {
  const m = /^\s*(\d+)/.exec(tier);
  return m ? Number(m[1]) : 99;
}

export function websiteHref(site: string): string {
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

export function websiteText(site: string): string {
  return site.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** Join words in plain English: "a", "a and b", "a, b and c". */
export function joinPlain(items: string[], word = "and"): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${word} ${items[items.length - 1]}`;
}

/** 13, 40 -> "32%". Rounds down, so a share is never shown higher than it is. */
export function percent(n: number, of: number, digits = 0): string {
  if (of === 0) return "none";
  const f = 10 ** digits;
  return `${(Math.floor(((n / of) * 100 + 1e-9) * f) / f).toFixed(digits)}%`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

/** First four-digit model year (1950-2039) in a line of text, or null. */
export function yearFromText(text: string): number | null {
  const m = /\b(19[5-9]\d|20[0-3]\d)\b/.exec(text);
  return m ? Number(m[1]) : null;
}
