import type { Sale } from "@/apparatus-signals/lib/data";
import { yearFromText } from "@/apparatus-signals/lib/format";

/** A closed sale with a known truck age (sale year minus model year). */
export interface SoldLot extends Sale {
  age: number;
}

export interface AgeBucket {
  label: string;
  count: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  low: number;
  high: number;
}

/** Truck-age bands in years. The last band is open. */
const BANDS: [number, number | null][] = [
  [0, 10],
  [10, 15],
  [15, 20],
  [20, 25],
  [25, 30],
  [30, 40],
  [40, null],
];

function bandLabel(min: number, max: number | null): string {
  if (min === 0 && max !== null) return `Under ${max} years`;
  if (max === null) return `${min} years or more`;
  return `${min} to ${max - 1} years`;
}

/** Linear-interpolated quantile of a sorted list. */
function quantile(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Rows with a confirmed sale price. A "high bid" row shows only the last bid seen. */
function isSold(s: Sale): boolean {
  return (s.status ?? "sold") === "sold" && (s.price_kind ?? "sold") === "sold";
}

export function splitSales(sales: Sale[]) {
  const sold = sales.filter(isSold);
  const lots: SoldLot[] = [];
  let noYear = 0;
  for (const s of sold) {
    const truckYear = s.year ?? yearFromText(s.item);
    const saleYear = Number(s.date?.slice(0, 4));
    const age = truckYear !== null && saleYear ? saleYear - truckYear : NaN;
    if (truckYear === null || !(age >= 0)) noYear++;
    else lots.push({ ...s, age });
  }
  const years = sold.map((s) => Number(s.date?.slice(0, 4))).filter((y) => y > 0);
  return {
    sold,
    lots,
    noYear,
    notSold: sales.length - sold.length,
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
  };
}

export function ageBuckets(lots: SoldLot[]): AgeBucket[] {
  return BANDS.map(([min, max]) => {
    const prices = lots
      .filter((l) => l.age >= min && (max === null || l.age < max))
      .map((l) => l.price)
      .sort((a, b) => a - b);
    if (prices.length === 0) return null;
    return {
      label: bandLabel(min, max),
      count: prices.length,
      p10: quantile(prices, 0.1),
      p25: quantile(prices, 0.25),
      median: quantile(prices, 0.5),
      p75: quantile(prices, 0.75),
      p90: quantile(prices, 0.9),
      low: prices[0],
      high: prices[prices.length - 1],
    };
  }).filter((b): b is AgeBucket => b !== null);
}

export function medianPrice(lots: SoldLot[]): number | null {
  if (lots.length === 0) return null;
  return quantile(
    lots.map((l) => l.price).sort((a, b) => a - b),
    0.5,
  );
}

/** Lot counts by state, largest first. Lots with no state go last. */
export function lotsByState(sales: Sale[]): { state: string | null; count: number }[] {
  const counts = new Map<string | null, number>();
  for (const s of sales) {
    const key = s.state && s.state_how !== "unknown" ? s.state : null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => {
      if (a.state === null) return 1;
      if (b.state === null) return -1;
      return b.count - a.count || a.state.localeCompare(b.state);
    });
}
