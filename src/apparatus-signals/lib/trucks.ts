// Words for a lead's truck and its guide price. Pure functions, safe on server and client.
import type { GuideTotal, PriceGuideRow, Truck } from "./data";
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

/** One line on the guide value of a list of leads. `where` is e.g. "on this list", or "" for all. */
export function guideTotalLine(total: GuideTotal, where = ""): string {
  const on = where ? ` ${where}` : "";
  if (total.trucks === 0) return `No truck${on} has a known type, so there is no guide value.`;
  // "About" a sum of medians: round to the nearest thousand.
  const about = total.median_sum >= 10000 ? Math.round(total.median_sum / 1000) * 1000 : total.median_sum;
  const verb = total.trucks === 1 ? "has" : "have";
  const they = total.trucks === 1 ? "it" : "they";
  return `${plural(total.trucks, "truck")}${on} ${verb} a known type. At auction ${they} would hammer for about ${formatMoney(about)}${total.trucks === 1 ? "" : " together"}.`;
}
