// Plain-English copy that is derived from the data: coverage tiers, layer
// sentences, and the links between signal kinds and the method tables.
import type { Basis, Coverage, HitRate, LeadTimeCase, Method, ReadBy, StateRow } from "./data";
import { joinPlain } from "./format";

export const COVERAGE_ORDER: Coverage[] = ["deep", "auctions", "national"];

export const COVERAGE: Record<Coverage, { name: string; long: string }> = {
  deep: {
    name: "Read in depth",
    long: "A person reads legal notices, board minutes and local news, on top of federal grants and trade-press columns. Each state page says if an auction site is read too.",
  },
  auctions: {
    name: "Auctions read",
    long: "Federal grants and trade-press columns, plus an auction site read by hand. Notices and minutes are not read yet.",
  },
  national: {
    name: "National layer only",
    long: "Only federal grants and trade-press columns. Thin lists here mean nobody has looked closer yet, not that nothing is for sale.",
  },
};

/** Short nouns for each layer, used inside sentences. */
const LAYER_NOUN: Record<string, { present: string; missing: string }> = {
  grants: { present: "federal grants", missing: "federal grants" },
  trade_press: { present: "trade-press columns", missing: "trade-press columns" },
  auctions: { present: "one auction site", missing: "auction sites" },
  notices: { present: "legal notices, board minutes and news", missing: "board minutes" },
};

function layerNoun(id: string, method: Method, which: "present" | "missing"): string {
  return LAYER_NOUN[id]?.[which] ?? (method.layers[id] ?? id).toLowerCase();
}

/** e.g. "Only federal grants and trade-press columns are read for Ohio. Nobody has read its auction sites or board minutes yet." */
export function layerSentence(state: StateRow, method: Method): string {
  const all = Object.keys(method.layers);
  const present = all.filter((id) => state.layers.includes(id));
  const missing = all.filter((id) => !state.layers.includes(id));
  if (present.length === 0) return `Nothing is read for ${state.name} yet.`;
  const presentText = joinPlain(present.map((id) => layerNoun(id, method, "present")));
  if (missing.length === 0) {
    return `Every layer is read for ${state.name}: ${presentText}.`;
  }
  const missingText = joinPlain(
    missing.map((id) => layerNoun(id, method, "missing")),
    "or",
  );
  return `Only ${presentText} are read for ${state.name}. Nobody has read its ${missingText} yet.`;
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
  snippet_only: "Seen only in a search summary, page not opened",
  arrived_last_year: "New truck arrived or was due 12 to 24 months ago, so the old one may be listed or gone",
  arrived_long_ago: "New truck arrived or was due over two years ago; a fleet fact, not a lead",
};

/** Short badge text for a lead's basis. */
export const BASIS_LABEL: Record<Basis, string> = { observed: "Seen", expected: "Expected" };

export const BASIS_LEGEND =
  "Seen: someone saw it happen, such as an auction lot, a board vote to sell or a delivered truck. Expected: a guess from a grant, an order or a due date.";

export const READ_BY_LABEL: Record<ReadBy, string> = {
  person: "Read by a person",
  feed: "From a feed",
};

/** The rule behind the top tier, in the words the method page uses. */
export const WEEK_RULE =
  "“Call this week” needs a signal someone saw: an auction lot, a board vote to sell, a delivered truck.";

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
