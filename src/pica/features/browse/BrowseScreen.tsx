"use client";

import { BASE } from "@/pica/lib/base";
import { Search } from "lucide-react";
import { use, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Card, Chip, EmptyState, Price, ProductImage, Rating, SkeletonCard, TextInput, cn } from "@/pica/components/kit";
import { Pica } from "@/pica/components/mascot";
import { CATEGORIES, type ApiError, type CatalogProduct, type Category } from "@/pica/lib/types";
import { ErrorNotice } from "@/pica/features/parts";
import { CATEGORY_WORDS } from "@/pica/features/shared/categories";
import { VERSION_STOCK_TEXT, priceLine, versionStock } from "@/pica/features/workspace/shortlist-model";
import { QUERY_MAX, parseBrowseParams, type BrowseView, type Results } from "./browse-model";
import {
  BROWSE,
  browseStatus,
  busyControl,
  focusAfterLoad,
  shownText,
  type FocusTarget,
  type LoadKind,
  type PendingFocus,
} from "./browse-screen-model";
import { useBrowse } from "./useBrowse";

/** 2 columns on phones, 3 from 640px, 4 from 1024px. */
export const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

const RESULTS_HEADING = "browse-results";
const SEARCH_BOX = "browse-search";
const ERROR_NOTICE = "browse-error";
const LOAD_MORE = "browse-load-more";
const tileHeadingId = (index: number) => `browse-product-${index}`;

function focusElement(target: FocusTarget): HTMLElement | null {
  if (target === null) return null;
  if (typeof target === "number") return document.getElementById(tileHeadingId(target));
  if (target === "retry") return document.getElementById(ERROR_NOTICE)?.querySelector("button") ?? null;
  const ids = { heading: RESULTS_HEADING, box: SEARCH_BOX, more: LOAD_MORE } as const;
  return document.getElementById(ids[target]);
}

interface BrowseScreenProps {
  searchParams: Promise<{ category?: string | string[]; q?: string | string[] }>;
}

export function BrowseScreen({ searchParams }: BrowseScreenProps) {
  const { category: initialCategory, query: initialQuery } = parseBrowseParams(use(searchParams));
  return <Browse key={`${initialCategory ?? ""}:${initialQuery}`} initialCategory={initialCategory} initialQuery={initialQuery} />;
}

/** The grid of grey tiles while the first page loads. Also the page's fallback. */
export function BrowseSkeleton() {
  return (
    <ul aria-hidden className={GRID}>
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i}>
          <SkeletonCard />
        </li>
      ))}
    </ul>
  );
}

export interface ProductTileProps {
  product: CatalogProduct;
  index: number;
  onAsk: () => void;
  /** A decision is opening from any tile: every Ask button waits. */
  starting: boolean;
  /** This tile's Ask was pressed. */
  asking: boolean;
  eager: boolean;
}

/**
 * One product: photo, merchant, name, price, rating, stock, and one action.
 * Price and stock follow the option card's rules: the matched version's
 * price plain, the range on a second line, never a struck-through price,
 * and "Stock not confirmed" when the catalog does not say.
 */
export function ProductTile({ product, index, onAsk, starting, asking, eager }: ProductTileProps) {
  const { price, range } = priceLine(product);
  return (
    <Card as="article" padding="sm" className="flex h-full flex-col gap-3">
      <ProductImage image={product.images[0]} alt={product.title} eager={eager} />
      <div className="flex flex-1 flex-col gap-1 px-1">
        <p className="text-body font-semibold break-words text-ink">{product.seller.name}</p>
        <h3 id={tileHeadingId(index)} tabIndex={-1} className="text-body break-words text-ink">
          {product.title}
        </h3>
        <Price price={price} otherVersions={range ?? undefined} />
        <Rating rating={product.rating} />
        <p className="text-caption text-ink-muted">{VERSION_STOCK_TEXT[versionStock(product)]}</p>
      </div>
      {/* No icon: at 320 the two-column tile is too narrow for one beside the
          words. For the same reason the busy spinner wraps onto its own line
          there, so "about" never breaks mid-word. */}
      <Button onClick={onAsk} disabled={starting && !asking} loading={asking} fullWidth className="flex-wrap">
        {BROWSE.ask}
        <span className="sr-only">: {product.title}</span>
      </Button>
    </Card>
  );
}

export interface BrowseLayoutProps {
  category: Category | null;
  text: string;
  /** Search was pressed with an empty box and no category. */
  hint: boolean;
  results: Results | null;
  /** The control whose load is running: Search for a search, "Load more" for more. */
  busy: LoadKind | null;
  error: ApiError | null;
  view: BrowseView;
  /** The hidden status line's words. */
  status: string;
  starting: boolean;
  askingId: string | null;
  onText: (text: string) => void;
  onCategory: (category: Category) => void;
  onSearch: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onAsk: (product: CatalogProduct) => void;
}

/** Browse with no fetching or routing, for tests. */
export function BrowseLayout(props: BrowseLayoutProps) {
  const { category, text, hint, results, busy, error, view, status, starting, askingId } = props;
  const products = results?.products ?? [];
  /** A new search is running over the products still shown. */
  const stale = busy === "search" && view.list;

  function submit(e: FormEvent) {
    e.preventDefault();
    props.onSearch();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-6 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-display font-semibold text-ink">{BROWSE.heading}</h1>
        <p className="text-body-lg text-ink">{BROWSE.intro}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div role="group" aria-label={BROWSE.categories} className="flex flex-wrap gap-x-2 gap-y-4">
          {CATEGORIES.map((value) => (
            <Chip
              key={value}
              label={CATEGORY_WORDS[value].many}
              selected={category === value}
              onClick={() => props.onCategory(value)}
            />
          ))}
        </div>

        <form onSubmit={submit} role="search" className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <TextInput
            id={SEARCH_BOX}
            label={BROWSE.searchLabel}
            type="search"
            placeholder={BROWSE.searchPlaceholder}
            value={text}
            maxLength={QUERY_MAX}
            error={hint ? BROWSE.hint : undefined}
            onChange={(e) => props.onText(e.target.value)}
            className="min-w-0 flex-1"
          />
          {/* The empty line matches the field's label, so from 640px the
              button lines up with the box whether or not a hint shows below. */}
          <div className="flex flex-col gap-1.5">
            <span aria-hidden className="invisible hidden text-body font-medium sm:block">
              {BROWSE.searchLabel}
            </span>
            {/* Secondary: Browse has no single main action, so nothing here is purple. */}
            <Button type="submit" on="canvas" icon={Search} size="lg" loading={busy === "search"}>
              {BROWSE.search}
            </Button>
          </div>
        </form>
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>

      {error ? (
        <div id={ERROR_NOTICE}>
          <ErrorNotice error={error} where="browse" onRetry={props.onRetry} />
        </div>
      ) : null}

      {view.prompt ? (
        <EmptyState art={<Pica pose="idle" size={120} />} title={BROWSE.promptTitle} description={BROWSE.promptLine} />
      ) : null}

      {view.skeleton ? (
        <div aria-busy="true">
          <BrowseSkeleton />
        </div>
      ) : null}

      {view.noMatch ? (
        <EmptyState
          art={<Pica pose="unsure" size={120} />}
          title={BROWSE.noMatchTitle}
          description={BROWSE.noMatchLine}
          action={
            <Button on="canvas" href={BASE}>
              {BROWSE.askInstead}
            </Button>
          }
        />
      ) : null}

      {results && view.list ? (
        <section aria-labelledby={RESULTS_HEADING} aria-busy={stale || undefined} className="flex flex-col gap-4">
          {/* The catalog's total is a rough count taken before non-USD products drop out, so it is not shown. */}
          <h2 id={RESULTS_HEADING} tabIndex={-1} className="text-heading font-semibold text-ink">
            {shownText(products.length)}
          </h2>
          {products.length === 0 ? (
            <p className="text-body text-ink">{BROWSE.emptyPage}</p>
          ) : (
            // Dimmed while a new search runs, so the old products do not read as its answer.
            <ul className={cn(GRID, "transition-opacity duration-(--duration-fast)", stale && "opacity-50")}>
              {products.map((product, index) => (
                <li key={product.id}>
                  <ProductTile
                    product={product}
                    index={index}
                    eager={index < 2}
                    starting={starting}
                    asking={starting && askingId === product.id}
                    onAsk={() => props.onAsk(product)}
                  />
                </li>
              ))}
            </ul>
          )}
          {results.nextCursor ? (
            <div className="flex justify-center">
              <Button id={LOAD_MORE} on="canvas" loading={busy === "more"} disabled={stale} onClick={props.onLoadMore}>
                {BROWSE.loadMore}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

/** Brief 6.9: look at products directly, and ask Pica about one in a new decision. */
function Browse({ initialCategory, initialQuery }: { initialCategory: Category | null; initialQuery: string }) {
  const browse = useBrowse(initialCategory, initialQuery);
  const { results, loading, error, view } = browse;
  /** The buyer has searched, picked or retried here, so the status line may speak. */
  const [acted, setActed] = useState(false);
  const [askingId, setAskingId] = useState<string | null>(null);
  /** What the last load was for, so its own control spins and "Try again" knows. */
  const [kind, setKind] = useState<LoadKind>("search");
  /** A load from "Load more" or "Try again", which moves focus when it ends. */
  const pendingFocus = useRef<PendingFocus | null>(null);
  const count = browse.products.length;
  const hasMore = Boolean(results?.nextCursor);
  const failed = error !== null;

  useEffect(() => {
    const pending = pendingFocus.current;
    if (pending === null || loading) return;
    pendingFocus.current = null;
    focusElement(focusAfterLoad(pending, { failed, after: count, hasMore, noMatch: view.noMatch }))?.focus();
  }, [loading, failed, count, hasMore, view.noMatch]);

  function search(start: () => void) {
    setActed(true);
    setKind("search");
    pendingFocus.current = null;
    start();
  }

  return (
    <BrowseLayout
      category={browse.category}
      text={browse.text}
      hint={browse.hint}
      results={results}
      busy={busyControl(loading, kind)}
      error={error}
      view={view}
      status={browseStatus({ acted, loading, hasError: failed, results, view })}
      starting={browse.starting}
      askingId={askingId}
      onText={browse.setText}
      onCategory={(value) => search(() => browse.pickCategory(value))}
      onSearch={() => search(browse.submit)}
      onRetry={() => {
        setActed(true);
        pendingFocus.current = { kind, retry: true, before: count };
        browse.retry();
      }}
      onLoadMore={() => {
        setActed(true);
        setKind("more");
        pendingFocus.current = { kind: "more", retry: false, before: count };
        browse.loadMore();
      }}
      onAsk={(product) => {
        setAskingId(product.id);
        browse.ask(product);
      }}
    />
  );
}
