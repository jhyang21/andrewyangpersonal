"use client";

import { BASE } from "@/pica/lib/base";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiError, CatalogProduct, CatalogSearchResult, Category } from "@/pica/lib/types";
import { postJson } from "@/pica/features/shared/api";
import { useStartDecision } from "@/pica/features/shared/useStartDecision";
import {
  askInput,
  browseUrl,
  browseView,
  categoryTap,
  mergePage,
  searchBody,
  searchesOnOpen,
  submitSearch,
  type Results,
  type SearchInput,
} from "./browse-model";

/**
 * Browse's search. Mount it with a `key` of the opening search: it reads the
 * opening values once. The request in flight is aborted on a newer search and
 * when the page goes.
 */
export function useBrowse(initialCategory: Category | null, initialQuery: string) {
  const [category, setCategory] = useState<Category | null>(initialCategory);
  const [text, setText] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(searchesOnOpen(initialCategory, initialQuery));
  const [error, setError] = useState<ApiError | null>(null);
  const [hint, setHint] = useState(false);
  const starter = useStartDecision();
  const request = useRef<AbortController | null>(null);
  /** The last search a button started, so "Try again" repeats that one. */
  const lastRequest = useRef<SearchInput>({ query: initialQuery, category: initialCategory });

  /**
   * Fetch one page. State changes only once the response arrives, so the
   * opening effect can call it too.
   */
  const load = useCallback((input: SearchInput) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    return postJson<CatalogSearchResult>(`${BASE}/api/catalog/search`, searchBody(input), controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setLoading(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        setResults((current) => mergePage(current, result.data, input.cursor));
      },
      () => {
        // Aborted by a newer search, which owns the loading state now.
      },
    );
  }, []);

  /** Fetch from an event handler: show the spinner and clear the old error first. */
  function run(input: SearchInput) {
    lastRequest.current = input;
    setLoading(true);
    setError(null);
    return load(input);
  }

  // Show a category's products as soon as the page opens.
  useEffect(() => {
    if (searchesOnOpen(initialCategory, initialQuery)) void load({ query: initialQuery, category: initialCategory });
    return () => request.current?.abort();
  }, [initialCategory, initialQuery, load]);

  /** Update the address bar only, so a reload or a shared link shows the same search. */
  function updateUrl(nextCategory: Category | null, nextQuery: string) {
    window.history.replaceState(null, "", browseUrl(nextCategory, nextQuery));
  }

  return {
    category,
    text,
    setText,
    results,
    products: results?.products ?? [],
    loading,
    error,
    /** Search was pressed with an empty box and no category. */
    hint,
    view: browseView({ results, loading, error }),
    starting: starter.busy,
    pickCategory(next: Category) {
      const tap = categoryTap(category, next, text);
      setCategory(tap.category);
      setQuery(tap.query);
      setHint(false);
      updateUrl(tap.category, tap.query);
      if (!tap.search) {
        // Back to the opening state. Drop a search still running, as a new
        // search would, so its late reply cannot fill the cleared list, and
        // drop its error, so "Try again" cannot repeat a search now gone.
        request.current?.abort();
        setLoading(false);
        setError(null);
        setResults(null);
        return;
      }
      void run({ query: tap.query, category: tap.category });
    },
    submit() {
      const outcome = submitSearch(text, category);
      if (outcome.kind === "hint") {
        setHint(true);
        return;
      }
      setHint(false);
      setQuery(outcome.query);
      updateUrl(category, outcome.query);
      void run({ query: outcome.query, category });
    },
    retry: () => void run(lastRequest.current),
    loadMore() {
      if (results?.nextCursor) void run({ query, category, cursor: results.nextCursor });
    },
    /** "Ask Pica about this" starts a new decision about the product. */
    ask: (product: CatalogProduct) => starter.start(askInput(product, category)),
  };
}
