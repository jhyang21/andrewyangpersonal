// Five-step sequential scale for the map: leads per 100 registry departments.
// Breaks are quintiles of the states that have any leads, so the scale follows
// the data as more states fill in. States with no leads get their own grey.

export interface Bin {
  index: number; // 1..5
  from: number;
  to: number | null; // null = open top
}

export interface MapScale {
  bins: Bin[];
  binFor: (rate: number) => number; // 0 = no leads, else 1..bins.length
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildScale(rates: number[], steps = 5): MapScale {
  const positive = rates.filter((r) => r > 0).sort((a, b) => a - b);
  const breaks: number[] = [];
  for (let i = 1; i < steps; i++) {
    if (positive.length === 0) break;
    const q = positive[Math.min(positive.length - 1, Math.floor((i / steps) * positive.length))];
    const b = round1(q);
    if (b > 0 && (breaks.length === 0 || b > breaks[breaks.length - 1])) breaks.push(b);
  }
  const bins: Bin[] = [];
  let from = 0;
  breaks.forEach((b, i) => {
    bins.push({ index: i + 1, from, to: b });
    from = b;
  });
  if (positive.length) bins.push({ index: bins.length + 1, from, to: null });
  return {
    bins,
    binFor(rate) {
      if (rate <= 0) return 0;
      let i = 0;
      while (i < breaks.length && rate >= breaks[i]) i++;
      return i + 1;
    },
  };
}

export function binLabel(bin: Bin): string {
  const f = (n: number) => n.toFixed(1);
  if (bin.to === null) return `${f(bin.from)} or more`;
  if (bin.from === 0) return `Under ${f(bin.to)}`;
  return `${f(bin.from)} to ${f(bin.to)}`;
}
