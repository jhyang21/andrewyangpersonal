/**
 * Live smoke test against the real Shopify Global Catalog. Skipped unless
 * SHOPIFY_LIVE=1. About eight calls. Prints titles and counts, never URLs.
 *
 *   SHOPIFY_LIVE=1 npx vitest run src/pica/lib/shopify/live.smoke.test.ts
 */
import { describe, expect, it } from "vitest";
import type { CatalogProduct, Category } from "@/pica/lib/types";
import { CATEGORY_TAXONOMY } from "./category";
import { BUYER_CONTEXT, CATALOG_ENDPOINT, CATALOG_TIMEOUT_MS, ucpMeta } from "./config";
import { ShopifyError, createCheckout, getProduct, searchCatalog } from "./index";
import { normalizeProducts } from "./normalize";
import { callTool } from "./transport";

const live = process.env.SHOPIFY_LIVE === "1";
const queries: Record<Category, string> = {
  bag: "leather tote for work",
  backpack: "commuter backpack for a 16 inch laptop",
  luggage: "carry-on suitcase",
};

describe.skipIf(!live)("live Shopify catalog", () => {
  const found: Partial<Record<Category, CatalogProduct[]>> = {};

  for (const category of Object.keys(queries) as Category[]) {
    it(`searches ${category}`, { timeout: 30_000 }, async () => {
      const r = await searchCatalog({ query: queries[category], category, maxPriceUsd: 400, limit: 10 });
      found[category] = r.products;
      console.log(
        `[live] ${category}: ${r.products.length} USD products, totalCount=${r.totalCount}, nextCursor=${r.nextCursor ? "yes" : "no"}`,
      );
      for (const p of r.products) {
        console.log(`  - ${p.title} | ${p.seller.name} | $${(p.variants[0].price.amount / 100).toFixed(2)} | available=${p.variants[0].available}`);
      }
      expect(r.products.length).toBeGreaterThan(0);
    });
  }

  it("probes filters.categories for backpacks (one call)", { timeout: 30_000 }, async () => {
    const content = await callTool({
      endpoint: CATALOG_ENDPOINT,
      tool: "search_catalog",
      args: {
        meta: ucpMeta(),
        catalog: {
          query: queries.backpack + " backpack",
          context: { ...BUYER_CONTEXT },
          filters: { available: true, ships_to: { country: "US" }, categories: CATEGORY_TAXONOMY.backpack },
          pagination: { limit: 10 },
        },
      },
      timeoutMs: CATALOG_TIMEOUT_MS,
    }).catch((e) => e);
    if (content instanceof Error) {
      console.log(`[live] category probe failed: ${content.name} ${(content as { text?: string }).text ?? ""}`);
      return;
    }
    const products = normalizeProducts(content.products, Date.now());
    const pagination = content.pagination as { total_count?: number } | undefined;
    console.log(
      `[live] category probe: ${products.length} USD products, totalCount=${pagination?.total_count}, messages=${JSON.stringify(content.messages ?? [])}`,
    );
    for (const p of products) console.log(`  - ${p.title}`);
  });

  it("gets one product", { timeout: 30_000 }, async () => {
    const first = found.backpack?.[0];
    expect(first).toBeDefined();
    const p = await getProduct(first!.id);
    console.log(
      `[live] getProduct: ${p.title} | options=${p.options.map((o) => `${o.name}(${o.values.length})`).join(", ")} | variants=${p.variants.length} | images=${p.images.length} | summarized=${p.summarized.features.length} features`,
    );
    expect(p.id).toBe(first!.id);
  });

  it("reports not_found for a product that does not exist", { timeout: 30_000 }, async () => {
    const err = await getProduct("gid://shopify/p/doesNotExist000").catch((e) => e);
    console.log(`[live] missing product -> ${err instanceof ShopifyError ? err.error.code : "resolved"}`);
  });

  it("starts a checkout on the direct path", { timeout: 30_000 }, async () => {
    const first = found.luggage?.[0];
    expect(first).toBeDefined();
    const v = first!.variants[0];
    const r = await createCheckout({ productId: first!.id, variantId: v.id, quantity: 1 }, null);
    console.log(
      `[live] createCheckout: ${first!.title} -> mode=${r.mode}, https=${r.continueUrl.startsWith("https://")}, sameAsCatalogLink=${r.continueUrl === v.checkoutUrl}`,
    );
    expect(r.continueUrl.startsWith("https://")).toBe(true);
  });
});
