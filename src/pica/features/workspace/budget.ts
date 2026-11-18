/** Reads the budget form. Bad input is an error to show, never a budget to drop. */

const NOT_A_NUMBER = "Enter an amount in dollars, like 150";
const TOO_BIG = "Enter an amount under $100,000";
const MAX_USD = 100_000;

export type BudgetInput =
  | { ok: true; minUsd?: number; maxUsd?: number }
  | { ok: false; errors: { min?: string; max?: string } };

/** One field: blank is "no limit", "$1,200" is 1200, anything else is an error. */
export function parseUsd(value: string): { ok: true; value?: number } | { ok: false; error: string } {
  const clean = value.replace(/[$,\s]/g, "");
  if (!clean) return { ok: true };
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return { ok: false, error: NOT_A_NUMBER };
  const amount = Number(clean);
  if (!Number.isFinite(amount)) return { ok: false, error: NOT_A_NUMBER };
  if (amount >= MAX_USD) return { ok: false, error: TOO_BIG };
  return { ok: true, value: amount };
}

export function parseBudget(min: string, max: string): BudgetInput {
  const low = parseUsd(min);
  const high = parseUsd(max);
  if (!low.ok || !high.ok) {
    return {
      ok: false,
      errors: { ...(low.ok ? {} : { min: low.error }), ...(high.ok ? {} : { max: high.error }) },
    };
  }
  return { ok: true, minUsd: low.value, maxUsd: high.value };
}
