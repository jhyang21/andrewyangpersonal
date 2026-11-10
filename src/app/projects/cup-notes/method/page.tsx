import type { Metadata } from "next";
import { getIndex, getLeverText, getPrompts } from "@/cup-notes/lib/data";
import { formatDate, formatNumber, usd } from "@/cup-notes/lib/format";
import { LEVER_ORDER } from "@/cup-notes/lib/levers";
import { BASE, pageOpenGraph } from "@/cup-notes/lib/site";
import { LEVER_INTRO, LEVER_TITLES, ROUND_SEES, tenure } from "@/cup-notes/lib/words";

const DESCRIPTION =
  "How the cup-note runs were made: the three rounds, the people, the prompts word for word, and what it cost.";

export const metadata: Metadata = {
  title: "Method",
  description: DESCRIPTION,
  openGraph: pageOpenGraph("Method", `${BASE}/method`, DESCRIPTION),
};

const STAGE_TITLES = { manager: "Manager", barista: "Barista", customer: "Customer" } as const;

export default function MethodPage() {
  const index = getIndex();
  const { meta } = index;
  const text = getLeverText();
  const prompts = getPrompts(meta.prompt_version);
  const { counts } = meta;
  const calls = counts.manager_calls + counts.barista_calls + counts.customer_calls;

  return (
    <div className="max-w-3xl space-y-10">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold">How it was made</h1>
        <div className="cn-prose text-lg">
          <p>
            Each person is one call to {meta.model}, reasoning effort {meta.reasoning_effort}, run
            through OpenAI&rsquo;s batch service. Three rounds. Each sees only what that person would
            know:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            {(["manager", "barista", "customer"] as const).map((r) => (
              <li key={r}>
                <strong>{ROUND_SEES[r].who}</strong> {ROUND_SEES[r].sees}
              </li>
            ))}
          </ul>
          <p>Same people in every run. What changes is the rule and the shift.</p>
        </div>
      </header>

      <section aria-labelledby="people-title" className="space-y-4">
        <h2 id="people-title" className="text-2xl font-semibold">
          The people
        </h2>
        <p className="text-cn-muted">
          {index.stores.length} stores, each with a manager and {index.stores[0]?.baristas.length ?? 0}{" "}
          baristas. {index.customers.length} kinds of customer, and each barista serves one of each.
        </p>
        <div className="space-y-4">
          {index.stores.map((store) => (
            <div key={store.key} className="cn-card cn-person">
              <h3 className="font-semibold">
                {store.name}
                <span className="font-normal text-cn-muted"> · {store.type_label}</span>
              </h3>
              <p className="mt-1 text-cn-muted">{store.setting}</p>
              <p className="mt-3">
                <strong>{store.manager.name}</strong>, manager for {tenure(store.manager.tenure_years)}.{" "}
                {store.manager.style_label}. Judged on {store.manager.judged_on}. {store.manager.blurb}
              </p>
              <ul className="mt-2 space-y-1">
                {store.baristas.map((b) => (
                  <li key={b.key}>
                    <strong>{b.name}</strong>, {b.tenure}. {b.blurb}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <h3 className="pt-2 font-semibold">Customers</h3>
        <ul className="space-y-1">
          {index.customers.map((c) => (
            <li key={c.key}>
              <strong>{c.label}.</strong> {c.blurb}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="memo-title" className="space-y-4">
        <h2 id="memo-title" className="text-2xl font-semibold">
          The memo
        </h2>
        <p className="text-cn-muted">
          Each run&rsquo;s memo is one line per lever, word for word what the managers read.
        </p>
        {LEVER_ORDER.map((lever) => (
          <div key={lever}>
            <h3 className="font-semibold">
              {LEVER_TITLES[lever]}
              <span className="font-normal text-cn-muted"> · {LEVER_INTRO[lever]}</span>
            </h3>
            <dl className="mt-2 space-y-2">
              {index.levers[lever].map((o) => (
                <div key={o.key}>
                  <dt className="font-medium">{o.label}</dt>
                  <dd className="cn-memo-line">&ldquo;{text[lever][o.key]}&rdquo;</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <section aria-labelledby="prompts-title" className="space-y-4">
        <h2 id="prompts-title" className="text-2xl font-semibold">
          The prompts
        </h2>
        <p className="text-cn-muted">
          Word for word, version {meta.prompt_version}. Anything in {"{{double braces}}"} is filled in
          per person.
        </p>
        {prompts.map((p) => (
          <details key={p.stage} className="cn-card cn-prompt">
            <summary>{STAGE_TITLES[p.stage]} prompt</summary>
            <h3 className="cn-policy-tag mt-3">System</h3>
            <pre>{p.system}</pre>
            <h3 className="cn-policy-tag mt-3">User</h3>
            <pre>{p.user}</pre>
          </details>
        ))}
      </section>

      <section aria-labelledby="wait-title" className="space-y-3">
        <h2 id="wait-title" className="text-2xl font-semibold">
          Wait times
        </h2>
        <p>
          Wait times are arithmetic: the line, plus the seconds each note added. The model never sets
          them.
        </p>
      </section>

      <section aria-labelledby="cost-title" className="space-y-3">
        <h2 id="cost-title" className="text-2xl font-semibold">
          Counts and cost
        </h2>
        {meta.source === "fixture" ? (
          <p>
            <strong>These answers are placeholders from a rule-based stand-in, not the model.</strong>{" "}
            The full run is {formatNumber(calls)} calls across {counts.scenarios} runs (
            {counts.manager_calls} manager, {formatNumber(counts.barista_calls)} barista,{" "}
            {formatNumber(counts.customer_calls)} customer).
          </p>
        ) : (
          <p>
            {formatNumber(calls)} calls across {counts.scenarios} runs ({counts.manager_calls} manager,{" "}
            {formatNumber(counts.barista_calls)} barista, {formatNumber(counts.customer_calls)}{" "}
            customer). {formatNumber(meta.tokens.input + meta.tokens.output)} tokens, {usd(meta.usd)}.{" "}
            {meta.schema_failures} answers failed the schema check. Generated{" "}
            {formatDate(meta.generated_at)}, prompt {meta.prompt_version}.
          </p>
        )}
        {meta.batch_ids.length > 0 && (
          <details>
            <summary className="cursor-pointer">Batch ids</summary>
            <ul className="mt-2 space-y-1 font-mono text-sm">
              {meta.batch_ids.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-labelledby="limits-title" className="space-y-3">
        <h2 id="limits-title" className="text-2xl font-semibold">
          Limits
        </h2>
        <p>
          Not Starbucks data. The stores and the people are invented and the model wrote every word
          they say. Not a forecast: it shows how a rule can bend on the way down, not how often it
          will. Use it like a tabletop exercise before a rollout to thousands of stores: it tells you
          what to test in real stores.
        </p>
      </section>
    </div>
  );
}
