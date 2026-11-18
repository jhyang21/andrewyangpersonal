import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seedProducts } from "@/app/projects/pica/kit/seed/fixture";
import type { CatalogProduct } from "@/pica/lib/types";
import { browseView, type Results } from "./browse-model";
import { BROWSE } from "./browse-screen-model";
import { BrowseLayout, GRID, ProductTile, type BrowseLayoutProps } from "./BrowseScreen";

const noop = () => {};
const [commuter, rollTop, slim] = seedProducts(1);

function layout(state: Partial<BrowseLayoutProps> & { results?: Results | null } = {}) {
  const results = state.results ?? null;
  const busy = state.busy ?? null;
  const loading = busy !== null;
  return renderToStaticMarkup(
    <BrowseLayout
      category={null}
      text=""
      hint={false}
      error={null}
      status=""
      starting={false}
      askingId={null}
      onText={noop}
      onCategory={noop}
      onSearch={noop}
      onRetry={noop}
      onLoadMore={noop}
      onAsk={noop}
      {...state}
      results={results}
      busy={busy}
      view={browseView({ results, loading, error: state.error ?? null })}
    />,
  );
}

function tile(product: CatalogProduct, extra: { starting?: boolean; asking?: boolean } = {}) {
  return renderToStaticMarkup(
    <ProductTile product={product} index={0} onAsk={noop} eager={false} starting={false} asking={false} {...extra} />,
  );
}

describe("BrowseLayout", () => {
  it("has one h1, the category chips and a labelled search", () => {
    const out = layout();
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain('role="group" aria-label="Category"');
    for (const label of ["Bags", "Backpacks", "Luggage"]) expect(out).toContain(`>${label}<`);
    expect(out).toContain('role="search"');
    expect(out).toMatch(/<label[^>]*>Search products<\/label>/);
  });

  it("marks the picked category as pressed", () => {
    expect(layout({ category: "luggage" })).toMatch(/aria-pressed="true"[^>]*>[\s\S]*?Luggage/);
  });

  it("has no purple fill, the focus ring aside", () => {
    const out = layout({ results: { products: [commuter, rollTop], nextCursor: "c" } });
    expect(out).not.toMatch(/(?<![:\w-])bg-shop-purple(?![\w-])/);
  });

  it("asks for a category or search before anything is searched", () => {
    const out = layout();
    expect(out).toContain(BROWSE.promptTitle);
    expect(out).toContain('data-pose="idle"');
  });

  it("shows grey tiles while the first page loads", () => {
    const out = layout({ busy: "search" });
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain(GRID);
    expect(out).not.toContain(BROWSE.promptTitle);
  });

  it("says plainly when nothing matches, with Pica unsure", () => {
    const out = layout({ results: { products: [], nextCursor: null } });
    expect(out).toContain(BROWSE.noMatchTitle);
    expect(out).toContain(BROWSE.noMatchLine);
    expect(out).toContain('data-pose="unsure"');
  });

  it("shows the server's error words as a banner with Try again", () => {
    const out = layout({ error: { code: "catalog_unavailable", message: "The catalog line, as sent." } });
    expect(out).toContain("The catalog line, as sent.");
    expect(out).toContain("Try again");
  });

  it("lays the products out 2, 3 and 4 to a row, with Load more while pages remain", () => {
    const out = layout({ results: { products: [commuter, rollTop, slim], nextCursor: "next" } });
    expect(out).toContain('<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ');
    expect(out).toContain("3 products shown");
    expect(out).toContain(BROWSE.loadMore);
    expect(layout({ results: { products: [commuter], nextCursor: null } })).not.toContain(BROWSE.loadMore);
  });

  describe("while a load runs", () => {
    const shown: Results = { products: [commuter, rollTop], nextCursor: "next" };
    const searchButton = /<button type="button"[^>]*aria-busy="true"[^>]*>(?:(?!<\/button>)[\s\S])*Search</;
    const moreButton = /<button[^>]*aria-busy="true" id="browse-load-more"/;

    it("spins Search for a new search, and dims the old products as busy", () => {
      const out = layout({ results: shown, busy: "search" });
      expect(out).toMatch(searchButton);
      expect(out).not.toMatch(moreButton);
      expect(out).toMatch(/<section aria-labelledby="browse-results" aria-busy="true"/);
      expect(out).toMatch(/<ul class="grid [^"]*opacity-50"/);
      expect(out).toMatch(/<button[^>]*disabled=""[^>]*id="browse-load-more"/);
    });

    it("spins Load more for more, and leaves Search and the products alone", () => {
      const out = layout({ results: shown, busy: "more" });
      expect(out).toMatch(moreButton);
      expect(out).not.toMatch(searchButton);
      expect(out).not.toContain('<section aria-labelledby="browse-results" aria-busy');
      expect(out).not.toContain("opacity-50");
    });

    it("spins nothing at rest", () => {
      expect(layout({ results: shown })).not.toContain('aria-busy="true"');
    });
  });

  it("from 640px lines the Search button up with the box, hint or no hint", () => {
    const out = layout({ hint: true });
    expect(out).toContain(BROWSE.hint.replace(/'/g, "&#x27;"));
    expect(out).toContain("sm:flex-row sm:items-start");
    expect(out).not.toContain("sm:items-end");
    expect(out).toMatch(/<span aria-hidden="true" class="invisible hidden text-body font-medium sm:block">Search products<\/span>/);
  });

  it("gives the box, the error and Load more ids that focus can find", () => {
    expect(layout()).toMatch(/<input id="browse-search"/);
    const failed = layout({ error: { code: "catalog_unavailable", message: "Down." } });
    expect(failed).toMatch(/<div id="browse-error">[\s\S]*Try again/);
  });

  it("keeps the hidden status line in place, with the words it is given", () => {
    expect(layout({ status: "4 products shown" })).toContain('<p role="status" class="sr-only">4 products shown</p>');
  });
});

describe("ProductTile", () => {
  it("shows the photo named for the product, merchant, name, price and one action", () => {
    const out = tile(commuter);
    expect(out).toContain(`>${commuter.seller.name}<`);
    expect(out).toMatch(new RegExp(`<h3[^>]*>${commuter.title}</h3>`));
    expect(out).toContain(`aria-label="${commuter.title}, no photo"`);
    expect(out).toContain("$");
    expect(out.match(/<button/g)).toHaveLength(1);
    expect(out).toContain(`${BROWSE.ask}<span class="sr-only">: ${commuter.title}</span>`);
  });

  it("never strikes a price through", () => {
    const listed = {
      ...commuter,
      variants: [{ ...commuter.variants[0], listPrice: { amount: 99_900, currency: "USD" } }],
    };
    const out = tile(listed);
    expect(out).not.toMatch(/line-through|<s>|<del/);
    expect(out).not.toContain("$999");
  });

  it("says stock for the matched version and never guesses", () => {
    expect(tile(rollTop)).toContain("This version is sold out.");
    expect(tile(slim)).toContain("Stock not confirmed");
  });

  it("waits while a decision opens, the pressed one busy", () => {
    expect(tile(commuter, { starting: true })).toMatch(/<button[^>]*disabled=""/);
    expect(tile(commuter, { starting: true, asking: true })).toContain('aria-busy="true"');
  });

  it("lets the busy spinner wrap above the words in a narrow tile", () => {
    expect(tile(commuter, { starting: true, asking: true })).toMatch(/<button[^>]*class="[^"]* flex-wrap"/);
  });
});
