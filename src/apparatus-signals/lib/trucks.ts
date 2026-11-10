// Words for a lead's truck and its guide price. Pure functions, safe on server and client.
import type { Ask, GuideTotal, PriceGuideRow, Truck } from "./data";
import { formatMoney, plural } from "./format";

/** truck.type_how when a record names the old truck. */
export const NAMED = "named in the record";

const TYPE_PLURAL: Record<string, string> = {
  pumper: "pumpers",
  aerial: "aerials",
  tanker: "tankers",
  rescue: "rescue trucks",
  brush: "brush trucks",
  "mini pumper": "mini pumpers",
  ambulance: "ambulances",
};

export function typePlural(type: string): string {
  return TYPE_PLURAL[type] ?? `${type}s`;
}

/** "16-20" -> "16 to 20 years old". */
export function bandLabel(band: string): string {
  if (band === "all ages") return "all ages";
  if (band.startsWith("<=")) return `${band.slice(2)} years old or less`;
  if (band.endsWith("+")) return `${band.slice(0, -1)} years old or more`;
  return `${band.replace("-", " to ")} years old`;
}

/** What the lead table shows in its Truck column. */
export function truckLabel(truck: Truck): string {
  if (truck.description) return truck.description;
  if (truck.type) return `${truck.type} (from the new truck)`;
  return "—";
}

/** "77 sales, pumper, 21 to 25 years old": the hover text on a guide price. */
export function guideTitle(g: PriceGuideRow): string {
  return `${plural(g.n, "sale")}, ${g.type}, ${bandLabel(g.band)}`;
}

/** "72 dealer listings of pumpers, 21 to 25 years old; asking prices, not sales": the hover text on a dealer ask. */
export function askTitle(type: string, a: Ask): string {
  return `${plural(a.n, "dealer listing")} of ${typePlural(type)}, ${bandLabel(a.band)}; asking prices, not sales`;
}

/** "About" a sum of medians: $3.67M from a million up, else the nearest thousand. */
function aboutMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return formatMoney(n >= 10_000 ? Math.round(n / 1000) * 1000 : n);
}

/** One line on the guide value of a list of leads. `where` is e.g. "on this list". */
export function guideTotalLine(total: GuideTotal, where = "on the lists in all states"): string {
  if (total.trucks === 0) return `No truck ${where} has a known type, so there is no guide value.`;
  const guide = `Guide value of the trucks ${where}: about ${aboutMoney(total.median_sum)} across ${plural(total.trucks, "truck")} with a known type.`;
  if (total.ask_sum <= 0) return guide;
  return `${guide} Dealers list trucks like them for about ${aboutMoney(total.ask_sum)} together, asking.`;
}
