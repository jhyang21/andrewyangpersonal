import { describe, expect, it } from "vitest";
import getProductFixture from "./__fixtures__/get-product.json";
import searchBackpack from "./__fixtures__/search-backpack.json";
import searchBag from "./__fixtures__/search-bag.json";
import searchLuggage from "./__fixtures__/search-luggage.json";
import { decodeEntities, htmlToText, httpsUrl, normalizeProduct, normalizeProducts } from "./normalize";

type Raw = Record<string, unknown> & { variants: Record<string, unknown>[] };
const NOW = 1_700_000_000_000;

function rawProducts(fixture: unknown): Raw[] {
  return (fixture as { result: { structuredContent: { products: Raw[] } } }).result.structuredContent
    .products;
}

const fixtures = { bag: searchBag, backpack: searchBackpack, luggage: searchLuggage };

describe("htmlToText", () => {
  it("decodes entity-escaped HTML, then strips the tags", () => {
    expect(htmlToText("&lt;p&gt;Water-repellent &amp;amp; light&lt;/p&gt;")).toBe("Water-repellent & light");
  });

  it("strips raw HTML and keeps list items on their own lines", () => {
    const html = '<ul>\n<li style="x">One  thing</li>\n<li>Two &amp; three</li>\n</ul>';
    expect(htmlToText(html)).toBe("One thing\nTwo & three");
  });

  it("drops script and style bodies and comments", () => {
    expect(htmlToText("<style>.a{color:red}</style><!-- note --><p>Kept</p><script>x()</script>")).toBe("Kept");
  });

  it("decodes numeric entities and nbsp", () => {
    expect(decodeEntities("15&#8243; laptop&nbsp;sleeve &#x2014; ok")).toBe("15″ laptop sleeve — ok");
    expect(htmlToText("a&nbsp;&nbsp;b")).toBe("a b");
  });

  it("leaves unknown named entities alone", () => {
    expect(decodeEntities("&madeup; stays")).toBe("&madeup; stays");
  });

  it("never turns a double-escaped tag into a real one", () => {
    expect(htmlToText("&amp;lt;script&amp;gt;x&amp;lt;/script&amp;gt;Kept")).toBe("Kept");
    const out = htmlToText("A &amp;lt;b&amp;gt;bold&amp;lt;/b&amp;gt; &amp;amp;lt;i&amp;amp;gt; claim");
    expect(out).not.toMatch(/<\/?[a-z][^>]*>/i);
    expect(out).toBe("A bold claim");
  });

  it("stops decoding after a few rounds, leaving deeper escapes as text", () => {
    const deep = "&amp;amp;amp;amp;amp;amp;lt;b&amp;amp;amp;amp;amp;amp;gt;";
    // Five rounds peel five "amp;" layers; the sixth stays as text.
    expect(htmlToText(deep)).toBe("&amp;lt;b&amp;gt;");
  });
});

describe("httpsUrl", () => {
  it("keeps https URLs byte-for-byte and drops anything else", () => {
    const url = "https://shop.example/buy/1:1?attribution/utm_source=shopify&_gsid=AbC";
    expect(httpsUrl(url)).toBe(url);
    expect(httpsUrl("http://shop.example/buy")).toBeUndefined();
    expect(httpsUrl("javascript:alert(1)")).toBeUndefined();
    expect(httpsUrl("not a url")).toBeUndefined();
    expect(httpsUrl(undefined)).toBeUndefined();
  });
});

describe("normalizeProducts against recorded searches", () => {
  for (const [name, fixture] of Object.entries(fixtures)) {
    describe(name, () => {
      const raw = rawProducts(fixture);
      const products = normalizeProducts(raw, NOW);

      it("keeps only USD products, with USD prices everywhere", () => {
        const usdCount = raw.filter(
          (p) => (p.price_range as { min: { currency: string } }).min.currency === "USD",
        ).length;
        expect(products).toHaveLength(usdCount);
        for (const p of products) {
          expect(p.priceRange.min.currency).toBe("USD");
          expect(p.priceRange.max.currency).toBe("USD");
          for (const v of p.variants) {
            expect(v.price.currency).toBe("USD");
            if (v.listPrice) expect(v.listPrice.currency).toBe("USD");
          }
        }
      });

      it("gives plain-text descriptions with no tags or entities left", () => {
        for (const p of products) {
          expect(p.descriptionText).not.toMatch(/<\/?[a-z][^>]*>/i);
          expect(p.descriptionText).not.toMatch(/&(lt|gt|amp|quot|nbsp);/);
          expect(p.descriptionText).not.toMatch(/ {2,}/);
        }
      });

      it("maps Shopify's generated metadata to `summarized`, never into the description", () => {
        raw.forEach((r) => {
          const p = products.find((x) => x.id === r.id);
          if (!p) return;
          const md = (r.metadata ?? {}) as Record<string, string[] | undefined>;
          expect(p.summarized.sellingPoints).toEqual(md.unique_selling_points ?? []);
          expect(p.summarized.features).toEqual(md.top_features ?? []);
          expect(p.summarized.specs).toEqual(md.tech_specs ?? []);
          for (const point of md.unique_selling_points ?? []) {
            expect(p.descriptionText).not.toContain(point);
          }
        });
      });

      it("copies variant fields as given, URLs unchanged", () => {
        raw.forEach((r) => {
          const p = products.find((x) => x.id === r.id);
          if (!p) return;
          const rv = r.variants[0] as Record<string, unknown> & {
            price: { amount: number };
            availability?: { available?: boolean };
            seller: { id: string; name: string; domain?: string };
          };
          const v = p.variants[0];
          expect(p.variants).toHaveLength(1);
          expect(v.id).toBe(rv.id);
          expect(v.price.amount).toBe(rv.price.amount);
          expect(v.available).toBe(rv.availability?.available ?? null);
          expect(v.url).toBe(rv.url);
          expect(v.checkoutUrl).toBe(rv.checkout_url);
          expect(v.options).toEqual(rv.options ?? []);
          expect(p.seller.id).toBe(rv.seller.id);
          expect(p.seller.name).toBe(rv.seller.name);
          expect(p.seller.domain).toBe(rv.seller.domain);
          expect(p.fetchedAt).toBe(NOW);
        });
      });
    });
  }

  it("drops the MYR and INR backpacks", () => {
    const products = normalizeProducts(rawProducts(searchBackpack), NOW);
    expect(products).toHaveLength(8);
    const titles = products.map((p) => p.title);
    expect(titles).not.toContain("Urban Canvas 14-Inch Backpack");
    expect(titles).not.toContain("Deccan Backpack - Charcoal");
  });

  it("reads the first bag fully", () => {
    const [tote] = normalizeProducts(rawProducts(searchBag), NOW);
    expect(tote.title).toBe("Leather Tote Bag");
    expect(tote.descriptionText.split("\n")[0]).toBe(
      "Natural beauty and character define our original design that you will cherish forever",
    );
    expect(tote.rating).toEqual({ value: 4.9, count: 29204, scaleMax: 5 });
    expect(tote.priceRange.min).toEqual({ amount: 22000, currency: "USD" });
    expect(tote.variants[0].listPrice).toBeUndefined();
    expect(tote.options.map((o) => o.name)).toEqual(["Color", "Style", "Accessory size"]);
    // Search gives no per-value availability, so it stays unknown.
    expect(tote.options[0].values[0]).toEqual({ label: "Black", available: null });
    expect(tote.seller.links.map((l) => l.type)).toEqual([
      "privacy_policy",
      "terms_of_service",
      "refund_policy",
    ]);
    expect(tote.images[0]).toMatchObject({ width: 1400, height: 1400 });
  });

  it("keeps a compare-at price when the merchant set one", () => {
    const [, marilyn] = normalizeProducts(rawProducts(searchBag), NOW);
    expect(marilyn.variants[0].listPrice?.currency).toBe("USD");
    expect(marilyn.variants[0].listPrice!.amount).toBeGreaterThan(marilyn.variants[0].price.amount);
  });

  it("leaves `summarized` empty when the catalog gives no metadata", () => {
    const beis = normalizeProducts(rawProducts(searchLuggage), NOW).find((p) =>
      p.title.startsWith("The Carry-On Roller"),
    );
    expect(beis?.summarized).toEqual({ sellingPoints: [], features: [], specs: [] });
  });

  it("decodes an entity-escaped description from Away", () => {
    const away = normalizeProducts(rawProducts(searchBackpack), NOW)[0];
    expect(away.title).toBe("Slim Commuter Backpack in Jet Black");
    expect(away.descriptionText.startsWith("The Signature Commuter Backpack is a work bag")).toBe(true);
  });
});

describe("normalizeProduct against the recorded get_product", () => {
  const raw = (getProductFixture as { result: { structuredContent: { product: unknown } } }).result
    .structuredContent.product;
  const p = normalizeProduct(raw, NOW)!;

  it("keeps option availability", () => {
    expect(p.options).toEqual([
      {
        name: "Color",
        values: [
          { label: "Dune Taupe", available: true },
          { label: "Jet Black", available: true },
          { label: "Navy Blue", available: true },
        ],
      },
    ]);
  });

  it("reads the selected variant", () => {
    const v = p.variants[0];
    expect(v.id).toBe("gid://shopify/ProductVariant/53458263474360");
    expect(v.price).toEqual({ amount: 15600, currency: "USD" });
    expect(v.listPrice).toEqual({ amount: 20800, currency: "USD" });
    expect(v.available).toBe(true);
    expect(v.options).toEqual([{ name: "Color", label: "Jet Black" }]);
    expect(v.checkoutUrl).toContain("attribution/click_id_value=");
    expect(p.seller.domain).toBe("766ad1-ab.myshopify.com");
    // The name is shown as the merchant wrote it, slogan and all.
    expect(p.seller.name).toBe("Away: Built for modern travel");
    expect(p.images).toHaveLength(9);
    expect(p.rating).toEqual({ value: 5, count: 3, scaleMax: 5 });
  });
});

describe("normalizeProduct edge cases", () => {
  const base = () =>
    JSON.parse(JSON.stringify(rawProducts(searchBag)[0])) as Raw & Record<string, unknown>;

  it("drops a product with no seller", () => {
    const r = base();
    delete r.variants[0].seller;
    expect(normalizeProduct(r, NOW)).toBeNull();
  });

  it("drops a product whose variant is not in USD", () => {
    const r = base();
    r.variants[0].price = { amount: 100, currency: "CAD" };
    expect(normalizeProduct(r, NOW)).toBeNull();
  });

  it("leaves availability null when the catalog does not say", () => {
    const r = base();
    delete r.variants[0].availability;
    expect(normalizeProduct(r, NOW)!.variants[0].available).toBeNull();
  });

  it("drops a non-https checkout link and leaves rating out when absent", () => {
    const r = base();
    r.variants[0].checkout_url = "http://insecure.example/buy";
    delete r.rating;
    const p = normalizeProduct(r, NOW)!;
    expect(p.variants[0].checkoutUrl).toBeUndefined();
    expect(p.rating).toBeUndefined();
  });

  it("marks an option value that does not exist as unavailable", () => {
    const r = base();
    r.options = [{ name: "Color", values: [{ label: "Red", available: true, exists: false }] }];
    expect(normalizeProduct(r, NOW)!.options[0].values[0].available).toBe(false);
  });
});
