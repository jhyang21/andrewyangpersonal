"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { dispatch } from "@/pica/lib/session";
import type { CatalogProduct } from "@/pica/lib/types";
import { productUrl, requestJson } from "./api";
import { STALE_AFTER_MS, checkedText, now } from "./format";

export type Freshness = "fresh" | "checking" | "may_have_changed";

/** Records older than the limit, oldest first. */
export function staleProducts(products: CatalogProduct[], at: number): CatalogProduct[] {
  return products.filter((product) => at - product.fetchedAt > STALE_AFTER_MS).sort((a, b) => a.fetchedAt - b.fetchedAt);
}

/**
 * Which products a panel has tried to fetch again. One attempt per product ID
 * each time the panel is shown: a client clock running fast would otherwise
 * find even a fresh copy "old" and fetch it again for ever.
 */
export function createTries() {
  const tried = new Set<string>();
  return {
    /** Stale records not yet tried while shown, now marked as tried. */
    takeDue(products: CatalogProduct[], at: number): CatalogProduct[] {
      const due = staleProducts(products, at).filter((product) => !tried.has(product.id));
      for (const product of due) tried.add(product.id);
      return due;
    },
    /** The panel hid (another tab, or Next hiding the page): the next showing tries again. */
    hidden() {
      tried.clear();
    },
  };
}

/**
 * The catalog route allows a burst of 10 calls, then one a second. Panels
 * show at most five products, so two at a time stays well inside it.
 */
const AT_ONCE = 2;

/**
 * While `active`, fetches again any shown record older than 10 minutes, a few
 * at a time, and saves the fresh copy to the session. Each product gets one
 * try each time the panel becomes active. A record whose check
 * fails is marked so the screen can say its price and stock may have changed.
 */
export function useFreshProducts(sessionId: string, products: CatalogProduct[], active: boolean) {
  const [status, setStatus] = useState<Record<string, Exclude<Freshness, "fresh">>>({});
  const [today, setToday] = useState<number | null>(null);
  const [tries] = useState(createTries);
  const key = products.map((product) => `${product.id}@${product.fetchedAt}`).join("|");

  // Runs when `active` changes and when Next hides the page.
  useLayoutEffect(() => () => tries.hidden(), [active, tries]);

  useEffect(() => {
    if (!active || products.length === 0) return;
    const at = now();
    const due = tries.takeDue(products, at);

    const set = (id: string, value: Exclude<Freshness, "fresh"> | null) =>
      setStatus((current) => {
        const next = { ...current };
        if (value) next[id] = value;
        else delete next[id];
        return next;
      });

    async function check(product: CatalogProduct) {
      const options = product.variants[0]?.options;
      const result = await requestJson<{ product: CatalogProduct }>(
        productUrl(product.id, options && options.length > 0 ? options : undefined),
      );
      if (result.ok && result.data?.product?.id === product.id) {
        dispatch(sessionId, { type: "products_merged", products: [result.data.product], at: now() });
        set(product.id, null);
      } else {
        set(product.id, "may_have_changed");
      }
    }

    // State is set in a callback, not in the effect body. Checks run to the end even if
    // the panel hides: each saves a fresh record the session wants anyway.
    void Promise.resolve().then(async () => {
      setToday(at);
      if (due.length === 0) return;
      setStatus((current) => {
        const next = { ...current };
        for (const product of due) next[product.id] = "checking";
        return next;
      });
      const queue = [...due];
      const worker = async () => {
        for (let product = queue.shift(); product; product = queue.shift()) await check(product);
      };
      await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker));
    });
    // `key` stands for `products`: refetch only when a record or its age changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, sessionId, tries]);

  return {
    today,
    freshness(product: CatalogProduct): Freshness {
      return status[product.id] ?? "fresh";
    },
  };
}

/** "Checked 2:14 PM", or what we know when the record is old. Sits beside price and stock. */
export function CheckedLine({
  product,
  freshness,
  today,
}: {
  product: CatalogProduct;
  freshness: Freshness;
  today: number | null;
}) {
  const checked = checkedText(product.fetchedAt, today ?? product.fetchedAt);
  return (
    <p className="text-caption text-ink-muted">
      {freshness === "checking"
        ? "Checking price and stock again"
        : freshness === "may_have_changed"
          ? `Price and stock may have changed. ${checked}`
          : checked}
    </p>
  );
}
