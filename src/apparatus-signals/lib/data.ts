// Typed loaders for the JSON in content/apparatus-signals. Server only: this module reads the
// file system at build time. Never import it from a "use client" file.
import fs from "node:fs";
import path from "node:path";
import { BASE } from "./site";

const DATA_DIR = path.join(process.cwd(), "content", "apparatus-signals");

// ---------- types ----------

export type Coverage = "national" | "auctions" | "deep";

export interface Source {
  name: string;
  url: string;
  read: string | null;
  note: string;
}

export interface Meta {
  updated: string;
  generated_at: string;
  totals: {
    states: number;
    departments_in_registry: number;
    leads: number;
    leads_week: number;
    /** Leads whose strongest signal a person read (an auction lot, a notice), not a feed. */
    hand_read_leads: number;
    /** Leads with at least one signal someone saw happen. */
    observed_leads: number;
    signals: number;
    deep_states: string[];
    auction_states: string[];
    sales: number;
  };
  sources: Source[];
}

export interface Threshold {
  below: number | null;
  rule: string;
}

export interface SaleRule {
  who_decides: string;
  law: string;
  url: string;
  thresholds: Threshold[];
  note: string;
}

export interface LeadCounts {
  week: number;
  month: number;
  watch: number;
  total: number;
}

export interface StateRow {
  code: string;
  name: string;
  departments: number;
  leads: LeadCounts;
  by_kind: Record<string, number>;
  coverage: Coverage;
  layers: string[];
  registry_fetched: string | null;
  rule: SaleRule | null;
}

export interface Department {
  rank: number;
  tier: string;
  score: number;
  department: string;
  city: string;
  county: string;
  why_call: string;
  detail: string;
  truck_for_sale: string;
  signal_date: string;
  other_signals: string;
  proof_url: string;
  proof_quote: string;
  checked: string;
  ask_for: string;
  website: string;
  type: string;
  registry_name: string;
  named_in_source: string;
  name_match: string;
  fdid: string;
  top_kind: string;
  basis: Basis;
  read_by: ReadBy;
}

/** "observed": someone saw a signal happen. "expected": every signal is a prediction. */
export type Basis = "observed" | "expected";
/** "person": read on the page by a person. "feed": read by a script from a data feed. */
export type ReadBy = "person" | "feed";

export interface Signal {
  source_name: string;
  source_city: string;
  source_county: string;
  fdid: string;
  match: string;
  kind: string;
  points: number;
  detail: string;
  date: string | null;
  old_truck: string | null;
  where: string;
  url: string;
  quote: string;
  read_by: ReadBy;
  checked?: string;
}

export interface Sale {
  /** Null when the listing names no state. */
  state: string | null;
  /** How the state was found. Missing in some rows; treat as unknown. */
  state_how?: "stated" | "registry" | "unknown";
  seller: string;
  item: string;
  price: number;
  date: string;
  url: string;
  item_kind: string;
  year: number | null;
  status?: string;
  /** "sold" is a confirmed sale price; "high bid" is only the last bid seen. */
  price_kind?: string;
  asked?: number | null;
  site?: string;
}

export interface Tier {
  floor: number;
  label: string;
}

export interface LeadTimeCase {
  state: string;
  seller: string;
  truck: string;
  auction_close: string;
  verdict: string;
  months_before_listing: number | null;
  trace_date: string | null;
  trace_kind: string | null;
  trace: string | null;
  url: string | null;
  note: string;
}

export interface HitRate {
  signal: string;
  found: number;
  state: string;
  as_of: string;
  next: string;
  /** Optional: signal kinds this row covers. Not in the data yet; used when present. */
  kinds?: string[];
}

/** One feed checked against closed auction sales: did the signal come first? */
export interface BacktestRecall {
  /** Sales whose look-back window overlaps the feed's dated span. */
  sales_coverable: number;
  sales_with_signal: number;
  /** Null when no sale fell inside the feed's dated span. */
  rate: number | null;
  raw_sales: number;
  raw_with_signal: number;
  raw_rate: number;
  matched_sales: number;
  mean_window_covered: number;
  median_lead_days: number | null;
  p25: number | null;
  p75: number | null;
}

/** Of departments with a signal, how many sold within 24 months, against the state's usual rate. */
export interface BacktestPrecision {
  departments: number;
  events: number;
  sold_within_24m: number;
  rate: number | null;
  base_rate: number | null;
  lift: number | null;
  registry_departments: number;
}

export interface Backtest {
  meta: {
    as_of: string;
    lots_total: number;
    lots_used: number;
    lots_used_apparatus: number;
    lots_used_ambulance: number;
    sale_events_apparatus: number;
    caveats: string[];
    [key: string]: unknown;
  };
  /** Keyed by feed: grant, order, delivery. */
  recall: Record<string, BacktestRecall>;
  /** State -> feed (grant, grant_all_years, order, delivery). */
  precision: Record<string, Record<string, BacktestPrecision>>;
}

export interface BlindReadGroup {
  departments: number;
  sign_within_18_months: number;
  sign_any_age: number;
  median_lead_days: number | null;
  lead_days: number[];
  /** Signal kind -> count of signs within 18 months. */
  kinds: Record<string, number>;
}

export interface BlindReadHit {
  group: "sold" | "control";
  department: string;
  county: string;
  kind: string;
  /** Full date, or a month ("2024-09"). */
  signal_date: string;
  lead_days: number;
  url: string;
  quote: string;
}

export interface BlindRead {
  meta: {
    as_of: string;
    state: string;
    design: string;
    caveats: string[];
    readers: string;
  };
  groups: { sold: BlindReadGroup; control: BlindReadGroup };
  hits: BlindReadHit[];
}

export interface Method {
  /** Feeds checked against closed auction sales. Null until the back-test has run. */
  backtest: Backtest | null;
  /** Hand-read public records, blind test. Null until it has run. */
  blind_read: BlindRead | null;
  points: Record<string, number>;
  labels: Record<string, string>;
  /** Signal kinds someone saw happen; every other kind is expected. */
  observed: string[];
  modifiers: Record<string, number>;
  tiers: Tier[];
  lead_time_cases: LeadTimeCase[];
  hit_rates: HitRate[];
  layers: Record<string, string>;
  rules: Record<string, SaleRule>;
}

export interface ChangelogRun {
  date: string;
  states: number;
  leads: number;
  leads_week: number;
  /** Missing in runs before these counts existed. */
  hand_read_leads?: number;
  observed_leads?: number;
  signals: number;
  new_leads: string[];
  new_lead_count: number;
  dropped: string[];
  dropped_count: number;
}

// ---------- reading ----------

// Phones stay in the private sheet; the site shows the registry website only.
const FORBIDDEN_KEYS = ["email_subject", "email_body", "phone", "contact_note"];

/** Throws if any object anywhere in the value carries a forbidden key. */
function assertNoForbiddenKeys(value: unknown, file: string): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenKeys(item, file);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.includes(key)) {
        throw new Error(
          `content/apparatus-signals/${file} has a "${key}" field. Outreach copy and phones must never reach the site; remove it in the pipeline.`,
        );
      }
      assertNoForbiddenKeys(child, file);
    }
  }
}

/**
 * One seller in sales.json is a real state vehicle depot whose name holds the word,
 * so that field may carry it. Anywhere else the capitalised word fails the build. The word is split so
 * it never appears whole in this file.
 */
const FORBIDDEN_WORD = new RegExp("\\bGar" + "age\\b");

function assertNoForbiddenWord(value: unknown, file: string, key = ""): void {
  if (typeof value === "string") {
    if (FORBIDDEN_WORD.test(value) && !(file === "sales.json" && key === "seller")) {
      throw new Error(`content/apparatus-signals/${file} has a forbidden word in field "${key}". Remove it in the pipeline.`);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenWord(item, file, key);
  } else if (value && typeof value === "object") {
    for (const [k, child] of Object.entries(value)) assertNoForbiddenWord(child, file, k);
  }
}

const cache = new Map<string, unknown>();

function readJson<T>(rel: string, fallback?: T): T {
  if (cache.has(rel)) return cache.get(rel) as T;
  const file = path.join(DATA_DIR, rel);
  if (!fs.existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing data file: content/apparatus-signals/${rel}`);
  }
  const value = JSON.parse(fs.readFileSync(file, "utf8")) as T;
  assertNoForbiddenKeys(value, rel);
  assertNoForbiddenWord(value, rel);
  cache.set(rel, value);
  return value;
}

function expectArray<T>(value: T[], rel: string): T[] {
  if (!Array.isArray(value)) throw new Error(`content/apparatus-signals/${rel} must be a JSON array`);
  return value;
}

export function getMeta(): Meta {
  return readJson<Meta>("meta.json");
}

export function getStates(): StateRow[] {
  return expectArray(readJson<StateRow[]>("states.json"), "states.json");
}

export function getState(code: string): StateRow | undefined {
  const upper = code.toUpperCase();
  return getStates().find((s) => s.code === upper);
}

export function getMethod(): Method {
  return readJson<Method>("method.json");
}

export function getSales(): Sale[] {
  return expectArray(readJson<Sale[]>("sales.json", []), "sales.json");
}

export function getChangelog(): ChangelogRun[] {
  return expectArray(readJson<ChangelogRun[]>("changelog.json", []), "changelog.json");
}

export function getSignals(code: string): Signal[] {
  const rel = `signals/${code.toUpperCase()}.json`;
  return expectArray(readJson<Signal[]>(rel, []), rel);
}

/** Ranked departments for one state, each with its page id. Throws on id clashes. */
export function getDepartments(code: string): DepartmentWithId[] {
  const rel = `departments/${code.toUpperCase()}.json`;
  const key = `ids:${rel}`;
  if (cache.has(key)) return cache.get(key) as DepartmentWithId[];
  const rows = expectArray(readJson<Department[]>(rel, []), rel);
  const seen = new Map<string, string>();
  const out = rows.map((row) => {
    const id = departmentId(row);
    const clash = seen.get(id);
    if (clash) {
      throw new Error(
        `content/apparatus-signals/${rel}: "${row.department}" and "${clash}" both map to page id "${id}". ` +
          `Give one of them an fdid (or a distinct noid- id) in the pipeline.`,
      );
    }
    seen.set(id, row.department);
    return { ...row, id };
  });
  cache.set(key, out);
  return out;
}

export type DepartmentWithId = Department & { id: string };

export function getDepartment(code: string, id: string): DepartmentWithId | undefined {
  return getDepartments(code).find((d) => d.id === id);
}

/** Signals that belong to a department: same fdid, or same source name when fdid is blank. */
export function signalsFor(code: string, dept: Department): Signal[] {
  return getSignals(code).filter((s) =>
    dept.fdid ? s.fdid === dept.fdid : !s.fdid && s.source_name === dept.department,
  );
}

// ---------- ids ----------

function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Page id: the registry fdid, or a slug of the name when fdid is blank. */
function departmentId(row: Pick<Department, "fdid" | "department">): string {
  return row.fdid ? row.fdid : slugify(row.department);
}

export function departmentHref(stateCode: string, row: Pick<Department, "fdid" | "department">): string {
  return `${BASE}/${stateCode.toLowerCase()}/${encodeURIComponent(departmentId(row))}`;
}

// ---------- roll-ups ----------

export interface LeadAcrossStates extends DepartmentWithId {
  stateCode: string;
  stateName: string;
}

export function allLeads(): LeadAcrossStates[] {
  return getStates().flatMap((s) =>
    getDepartments(s.code).map((d) => ({ ...d, stateCode: s.code, stateName: s.name })),
  );
}

/** Strongest leads first: score, then tier, then most recent signal. */
export function compareLeads(a: Department, b: Department): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.tier !== b.tier) return a.tier.localeCompare(b.tier);
  return (b.signal_date || "").localeCompare(a.signal_date || "");
}

export function leadsPer100(s: StateRow): number {
  return s.departments > 0 ? (s.leads.total / s.departments) * 100 : 0;
}
