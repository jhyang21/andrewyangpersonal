import type { Metadata } from "next";
import { getChangelog } from "@/cup-notes/lib/data";
import { formatDate, formatNumber, usd } from "@/cup-notes/lib/format";
import { BASE, pageOpenGraph } from "@/cup-notes/lib/site";

const DESCRIPTION =
  "Every generated dataset behind the cup-note runs: model, prompt version, batches and cost.";

export const metadata: Metadata = {
  title: "Changelog",
  description: DESCRIPTION,
  openGraph: pageOpenGraph("Changelog", `${BASE}/changelog`, DESCRIPTION),
};

export default function ChangelogPage() {
  const entries = [...getChangelog()].sort((a, b) => b.generated_at.localeCompare(a.generated_at));

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Changelog</h1>
        <p className="text-cn-muted">One entry per batch run, newest first.</p>
      </header>
      <ol className="space-y-6">
        {entries.map((e) => {
          const calls = e.counts.manager_calls + e.counts.barista_calls + e.counts.customer_calls;
          return (
            <li key={`${e.generated_at}-${e.prompt_version}`} className="cn-card cn-change">
              <h2 className="text-xl font-semibold">
                <time dateTime={e.generated_at}>{formatDate(e.generated_at)}</time>
                <span className="font-normal text-cn-muted"> · prompt {e.prompt_version}</span>
              </h2>
              <p className="mt-2">{e.note}</p>
              <dl className="cn-change-facts">
                <dt>Model</dt>
                <dd>
                  {e.model}, reasoning effort {e.reasoning_effort}
                </dd>
                <dt>Calls</dt>
                <dd>
                  {formatNumber(calls)} across {e.counts.scenarios} runs
                </dd>
                <dt>Tokens</dt>
                <dd>
                  {formatNumber(e.tokens.input)} in, {formatNumber(e.tokens.output)} out
                </dd>
                <dt>Cost</dt>
                <dd>{usd(e.usd)}</dd>
                <dt>Schema failures</dt>
                <dd>{e.schema_failures}</dd>
              </dl>
              {e.batch_ids.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer">Batch ids</summary>
                  <ul className="mt-2 space-y-1 font-mono text-sm">
                    {e.batch_ids.map((id) => (
                      <li key={id}>{id}</li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
