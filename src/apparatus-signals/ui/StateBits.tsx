import type { Method, SaleRule, StateRow } from "@/apparatus-signals/lib/data";
import { formatDate, formatMoney, formatNumber } from "@/apparatus-signals/lib/format";
import { COVERAGE, layerSentence } from "@/apparatus-signals/lib/words";
import Ext from "@/apparatus-signals/ui/Ext";

export function CoverageCard({ state, method }: { state: StateRow; method: Method }) {
  const cov = COVERAGE[state.coverage];
  const layerIds = Object.keys(method.layers);
  return (
    <section aria-labelledby="coverage-title" className="rounded border border-as-rule p-4">
      <h2 id="coverage-title" className="eyebrow">
        Coverage
      </h2>
      <p className="mt-1 text-lg font-semibold">{cov.name}</p>
      <p className="mt-1 max-w-3xl">{layerSentence(state, method)}</p>
      <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
        {layerIds.map((id) => {
          const on = state.layers.includes(id);
          return (
            <li key={id} className={on ? "" : "text-as-muted"}>
              <span aria-hidden="true" className="num mr-1 inline-block w-4">
                {on ? "✓" : "–"}
              </span>
              {method.layers[id]}
              <span className="sr-only">{on ? ": read" : ": not read yet"}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-as-ink-2">
        USFA registry: {formatNumber(state.departments)} departments in {state.name}
        {state.registry_fetched ? ` (pulled ${formatDate(state.registry_fetched)})` : ""}.
      </p>
    </section>
  );
}

function thresholdLabel(rule: SaleRule, i: number): string {
  const t = rule.thresholds[i];
  const prev = i > 0 ? rule.thresholds[i - 1].below : null;
  if (t.below !== null && prev === null) return `Under ${formatMoney(t.below)}`;
  if (t.below !== null && prev !== null) return `${formatMoney(prev)} to ${formatMoney(t.below)}`;
  if (prev !== null) return `${formatMoney(prev)} or more`;
  return "Any price";
}

export function RuleBox({ state, rule }: { state: StateRow; rule: SaleRule | null }) {
  return (
    <section aria-labelledby="rule-title" className="rounded border border-as-rule p-4">
      <h2 id="rule-title" className="text-lg font-semibold">
        Who decides the sale
      </h2>
      {rule ? (
        <>
          <p className="mt-1 max-w-3xl">{rule.who_decides}</p>
          <table className="data-table mt-3">
            <caption className="sr-only">Sale rules by truck price in {state.name}</caption>
            <thead>
              <tr>
                <th scope="col">Truck price</th>
                <th scope="col">What it takes</th>
              </tr>
            </thead>
            <tbody>
              {rule.thresholds.map((t, i) => (
                <tr key={i}>
                  <td className="num whitespace-nowrap font-semibold">{thresholdLabel(rule, i)}</td>
                  <td data-label="What it takes">{t.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rule.note ? <p className="mt-3 text-as-ink-2">{rule.note}</p> : null}
          <p className="mt-2 text-sm">
            Law: <Ext href={rule.url}>{rule.law}</Ext>
          </p>
        </>
      ) : (
        <p className="mt-1 text-as-ink-2">
          We have not looked up {state.name}&rsquo;s sale rules yet.
        </p>
      )}
    </section>
  );
}
