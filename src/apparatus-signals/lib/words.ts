// Plain-English copy that is derived from the data: coverage tiers, what each state gets
// read, stages, check and match labels, and the links between signal kinds and the method tables.
import type {
  Basis,
  Checked,
  Coverage,
  HitRate,
  LeadTimeCase,
  ListingWindow,
  Method,
  ReadBy,
  Stage,
  StateRow,
} from "./data";
import { formatWindow, joinPlain } from "./format";

export const COVERAGE_ORDER: Coverage[] = ["deep", "auctions", "national"];

export const COVERAGE: Record<Coverage, { name: string; long: string }> = {
  deep: {
    name: "Read by hand",
    long: "We read legal notices, board minutes and local news by hand, on top of the grant and trade-press feeds.",
  },
  auctions: {
    name: "Auctions read by hand",
    long: "Grant and trade-press feeds, plus an auction site read by hand. Minutes and notices not yet.",
  },
  national: {
    name: "Feeds only",
    long: "Grant and trade-press feeds only. No one has read this state’s minutes yet, so a short list means no one looked.",
  },
};

/** How each source shows up in the coverage sentence on a state page. */
const SOURCE_WORDS: Record<string, { feed?: string; extra?: string; missing: string }> = {
  grants: { feed: "grant", missing: "grant feed" },
  trade_press: { feed: "trade-press", missing: "trade-press feed" },
  auctions: { extra: "an auction site read by hand", missing: "auction sites" },
  notices: { extra: "minutes and notices read by hand", missing: "board minutes" },
};

/** One sentence on what we read for a state, and what we have not opened yet. */
export function layerSentence(state: StateRow, method: Method): string {
  const all = Object.keys(method.layers);
  const present = all.filter((id) => state.layers.includes(id));
  const missing = all.filter((id) => !state.layers.includes(id));
  if (present.length === 0) return `${state.name}: nothing read yet.`;
  if (missing.length === 0) {
    return `${state.name} gets the full read: grants, trade press, Auctions International, and board minutes and legal notices.`;
  }
  const feeds = present.map((id) => SOURCE_WORDS[id]?.feed).filter((w): w is string => Boolean(w));
  const extras = present
    .filter((id) => !SOURCE_WORDS[id]?.feed)
    .map((id) => SOURCE_WORDS[id]?.extra ?? (method.layers[id] ?? id).toLowerCase());
  const parts = [feeds.length ? `${joinPlain(feeds)} feeds` : "", ...extras].filter(Boolean);
  const read = extras.length ? joinPlain(parts) : `${parts[0]} only`;
  const missingText = joinPlain(
    missing.map((id) => SOURCE_WORDS[id]?.missing ?? (method.layers[id] ?? id).toLowerCase()),
    "or",
  );
  return `${state.name}: ${read}. No one has opened its ${missingText} yet.`;
}

/** The order the stage groups appear in, and their headings. */
export const STAGE_ORDER: Stage[] = ["surplus", "replacing", "gear", "listed", "sold"];

export const STAGE_LABEL: Record<Stage, string> = {
  surplus: "Old truck out of service, not listed yet",
  replacing: "Replacing a truck",
  gear: "Sells gear at auction; no truck named",
  listed: "At auction now",
  sold: "Sold recently",
};

/**
 * A stage group's heading. The sold group names closed bids and direct
 * sales only when one of its leads (`topKinds`, all of the group, not the
 * filtered view) is one.
 */
export function stageHeading(stage: Stage, topKinds: string[]): string {
  if (stage !== "sold") return STAGE_LABEL[stage];
  const [first, second] = [
    topKinds.includes("bids_closed") ? "bids closed" : "",
    topKinds.includes("direct_sale") ? "going direct to a buyer" : "",
  ].filter(Boolean);
  if (!first) return STAGE_LABEL.sold;
  return second ? `Sold, ${first}, or ${second}` : `Sold, or ${first}`;
}

/** Not yet at auction or sold: the leads worth a call, and the only ones ranked. */
export function isOpenStage(stage: Stage): boolean {
  return stage === "surplus" || stage === "replacing";
}

/** Already on a channel. Gear is neither open nor done. */
export function isDoneStage(stage: Stage): boolean {
  return stage === "listed" || stage === "sold";
}

/** The state table's When cell for a lead with no tier (gear or done); null for the rest. */
export function shortWhen(stage: Stage, topKind: string): string | null {
  if (stage === "gear") return "Gear only";
  if (stage === "listed") return "At auction";
  if (stage === "sold") {
    if (topKind === "bids_closed") return "Bids closed";
    return topKind === "direct_sale" ? "Direct sale" : "Sold";
  }
  return null;
}

/**
 * What the "Likely listed" column shows. `month` is the run month
 * ("YYYY-MM"); a window that ended before it has passed.
 */
export function likelyListed(
  d: { stage: Stage; top_kind: string; window: ListingWindow | null },
  month: string,
): string {
  if (d.stage === "listed") return "Now";
  if (d.stage === "sold") return shortWhen(d.stage, d.top_kind) as string;
  if (!d.window) return "—";
  return d.window.to < month
    ? `Was due ${formatWindow(d.window)}; may already have sold`
    : formatWindow(d.window);
}

/**
 * A window rule's template as a general sentence: {month} and {season} become
 * plain words. Any other placeholder stays as it is.
 */
export function fillTemplate(template: string): string {
  return template.replace(/\{month\}/g, "that month").replace(/\{season\}/g, "that season");
}

/** "0–6 months after the promised delivery month": a window rule's span and what it counts from. */
export function windowSpan(rule: {
  kinds: string[];
  anchor?: string;
  from_months: number;
  to_months: number;
}): string {
  const span = `${rule.from_months}–${rule.to_months} months`;
  if (rule.anchor === "expected") return `${span} after the promised delivery month`;
  if (rule.anchor === "today") return `${span} after the notice, or the run date when the notice has none`;
  if (rule.anchor === "date" && rule.kinds.length === 1 && rule.kinds[0] === "new_truck_ordered") {
    return `${span} after the order date`;
  }
  return `${span} after the signal date`;
}

/**
 * The How cell of a window rule, as a worked example: the real `window.how` of
 * the first lead whose top kind the rule covers and whose wording came from
 * this rule's template (two rules can share a kind). Null when no lead fits;
 * the caller then shows the filled template.
 */
export function windowExample(
  rule: { kinds: string[]; how_template: string },
  leads: { top_kind: string; window: ListingWindow | null }[],
): string | null {
  const pattern = rule.how_template
    .split(/\{\w+\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    // A placeholder never spans a ";", so past wording ("…; probably sold by now") does not fit.
    .join("[^;]+?");
  const re = new RegExp(`^${pattern}\\.?$`, "i");
  const pick = leads.find((d) => rule.kinds.includes(d.top_kind) && re.test(d.window?.how ?? ""));
  return pick?.window ? pick.window.how.replace(/\.$/, "") : null;
}

export const DONE_NOTE = "Listed, sold, bids closed or going direct; kept for the record.";

const SECOND_READER = "Checked by a second reader";

const CHECKED_LABEL: Record<Checked, string> = {
  confirmed: SECOND_READER,
  corrected: SECOND_READER,
  partly: "Partly checked",
  unreachable: "Page no longer online",
  not_rechecked: "Not yet double-checked",
  auction_site: "Read on the auction site",
  fema_table: "From FEMA’s awards table",
  fema_open_data: "From FEMA open data",
  trade_press: "From a trade-press delivery column",
  opened: "Page opened by hand",
};

/** Label for a checked value; "" when there is none. Unknown values show as they come. */
export function checkedLabel(value: string | null | undefined): string {
  if (!value) return "";
  return CHECKED_LABEL[value as Checked] ?? value.replace(/_/g, " ");
}

/** How a source's name was matched to the USFA registry. */
const MATCH_LABEL: Record<string, string> = {
  exact: "exact name match",
  fuzzy: "close name match",
  "by town (only department there)": "the only department in its town",
  "hand-checked alias": "matched by hand",
  "not in registry": "not in the federal registry",
};

/** Also covers "exact, ambiguous (3 same-name rows)" and the like. */
export function matchLabel(value: string): string {
  if (MATCH_LABEL[value]) return MATCH_LABEL[value];
  const m = /^(exact|fuzzy), ambiguous \((\d+) same-name rows\)$/.exec(value);
  if (m) {
    return `${m[1] === "exact" ? "exact name" : "close name"}, shared by ${m[2]} departments`;
  }
  return value;
}

/**
 * Which hit-rate row speaks for a signal kind. The hit-rate rows are labelled
 * in words, not kinds, so this table links the two vocabularies. A row that
 * carries its own `kinds` list wins over this table.
 */
const KIND_GROUP: Record<string, string> = {
  auction_open: "Truck at auction now",
  surplus_declared: "Board voted to sell",
  new_truck_arrived: "New truck in service",
  delivery_due: "Money approved or truck ordered",
  new_truck_ordered: "Money approved or truck ordered",
  bond_or_referendum: "Money approved or truck ordered",
  council_approval: "Money approved or truck ordered",
  grant: "Federal vehicle grant",
  afg_large: "Federal vehicle grant",
};

export function hitRatesFor(kind: string, method: Method): HitRate[] {
  const explicit = method.hit_rates.filter((h) => h.kinds?.includes(kind));
  if (explicit.length) return explicit;
  const label = KIND_GROUP[kind];
  return label ? method.hit_rates.filter((h) => h.signal === label && !h.kinds) : [];
}

/** Lead-time cases whose earliest trace is the same kind of signal (same group). */
export function leadTimeCasesFor(kind: string, method: Method): LeadTimeCase[] {
  const group = KIND_GROUP[kind];
  return method.lead_time_cases.filter((c) => {
    if (!c.trace_kind) return false;
    if (c.trace_kind === kind) return true;
    return group !== undefined && KIND_GROUP[c.trace_kind] === group;
  });
}

/** Plain labels for score modifiers. method.json names them but gives no label. */
const MODIFIER_LABELS: Record<string, string> = {
  old_truck_named: "The source names the truck being replaced",
  recent: "Signal dated in the last 90 days",
  repeat_seller: "Sold two or more trucks since May",
  stale: "Surplus vote over 180 days old with no sale seen",
  grant_due: "Vehicle grant won one to three years ago, so the new truck is due",
  snippet_only: "Seen only in a search summary; page not opened",
  arrived_last_year: "New truck arrived or was due 12 to 24 months ago, so the old one may be listed or gone",
  arrived_long_ago: "New truck arrived or was due over two years ago; the old one is likely gone",
  window_passed: "Listing window ended, no listing found; it may have sold quietly",
};

/** Short badge text for a lead's basis. */
export const BASIS_LABEL: Record<Basis, string> = { observed: "Seen", expected: "Expected" };

export const BASIS_LEGEND =
  "Seen: an open lot, a vote to sell or a delivered truck. Expected: inferred from a grant, an order or a due date.";

export const READ_BY_LABEL: Record<ReadBy, string> = {
  person: "Read by hand",
  feed: "From a feed",
};

/** The rule behind the top tier, in the words the method page uses. */
export const WEEK_RULE =
  "“Call this week” means we saw it: an open auction lot, a vote to sell, or a new truck in service.";

export function modifierLabel(name: string): string {
  return MODIFIER_LABELS[name] ?? name.replace(/_/g, " ");
}

export const VERDICT_LABELS: Record<string, string> = {
  trace_found: "Earlier sign found",
  weak_trace: "Weak sign only",
  no_trace: "No earlier sign found",
};

export function kindLabel(kind: string, method: Method): string {
  return method.labels[kind] ?? kind.replace(/_/g, " ");
}
