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

/** One line on the guide value of a list of leads. */
export function guideTotalLine(total: GuideTotal, where: string): string {
  if (total.trucks === 0) {
    return `No lead ${where} names a truck of a known type, so there is no guide value.`;
  }
  // "About" a sum of medians: round to the nearest thousand.
  const about = total.median_sum >= 10000 ? Math.round(total.median_sum / 1000) * 1000 : total.median_sum;
  return `Guide value of the trucks ${where}: about ${formatMoney(about)} across ${plural(total.trucks, "truck")} with a known type; the rest are unknown.`;
}
