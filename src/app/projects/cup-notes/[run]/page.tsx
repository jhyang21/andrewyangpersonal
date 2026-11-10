import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getIndex, getLeverText, getRun, getRunKeys } from "@/cup-notes/lib/data";
import { LEVER_ORDER, leverLabel, neighbours, parseKey, scenarioName } from "@/cup-notes/lib/levers";
import { pageOpenGraph, runHref } from "@/cup-notes/lib/site";
import type { LeverKey } from "@/cup-notes/lib/types";
import { HOW_TO_READ, LEVER_TITLES, compareSentence } from "@/cup-notes/lib/words";
import { LeverPicker } from "@/cup-notes/ui/LeverPicker";
import { RunChain } from "@/cup-notes/ui/RunChain";
import { RunsTable } from "@/cup-notes/ui/RunsTable";
import { StoreRecord } from "@/cup-notes/ui/StoreRecord";
import { TradeoffChart } from "@/cup-notes/ui/TradeoffChart";

type Params = { params: Promise<{ run: string }> };

export function generateStaticParams() {
  return getRunKeys().map((run) => ({ run }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { run } = await params;
  const index = getIndex();
  const selection = parseKey(index, run);
  if (!selection) return {};
  const name = scenarioName(index, selection);
  const description = `One run of the cup-note rule: ${name}. Six stores, twelve baristas, 96 cups.`;
  return {
    title: name,
    description,
    openGraph: pageOpenGraph(name, runHref(run), description),
  };
}

export default async function RunPage({ params }: Params) {
  const { run } = await params;
  const detail = getRun(run);
  if (!detail) notFound();
  const index = getIndex();
  const text = getLeverText();
  const selection = detail.levers;
  const memo = Object.fromEntries(
    LEVER_ORDER.map((l) => [l, text[l][selection[l]] ?? ""]),
  ) as Record<LeverKey, string>;
  const near = neighbours(index, selection).map(({ lever, run: other }) => ({
    lever,
    key: other.key,
    ...compareSentence(
      leverLabel(index, lever, selection[lever]),
      leverLabel(index, lever, other.levers[lever]),
      detail.outcomes,
      other.outcomes,
    ),
  }));

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold sm:text-3xl">{scenarioName(index, selection)}</h1>
        <LeverPicker index={index} selection={selection} />
      </header>

      <section aria-labelledby="chain-title">
        <h2 id="chain-title" className="sr-only">
          From the memo to the cup
        </h2>
        <RunChain index={index} detail={detail} memo={memo} />
        <p className="cn-prose mt-6 max-w-3xl">{HOW_TO_READ}</p>
      </section>

      <section aria-labelledby="stores-title" className="space-y-4">
        <h2 id="stores-title" className="text-2xl font-semibold">
          The six stores
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {index.stores.map((store) => (
            <StoreRecord key={store.key} index={index} detail={detail} store={store} />
          ))}
        </div>
      </section>

      {near.length > 0 && (
        <section aria-labelledby="near-title" className="space-y-4">
          <h2 id="near-title" className="text-2xl font-semibold">
            One lever away
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {near.map((n) => (
              <li key={n.key} className="cn-card cn-near">
                <p className="cn-policy-tag">{LEVER_TITLES[n.lever]}</p>
                <p className="font-semibold">
                  <Link href={runHref(n.key)}>{n.title}</Link>
                </p>
                <p className="text-cn-muted">{n.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="all-title" className="space-y-4">
        <h2 id="all-title" className="text-2xl font-semibold">
          All {index.scenarios.length} runs
        </h2>
        <TradeoffChart index={index} selection={selection} />
        <RunsTable index={index} highlight={detail.key} />
      </section>
    </div>
  );
}
