/**
 * Made-up products, a shortlist and a comparison, shared by the scripted demo
 * and the kit's seed decision. Pure, apart from the time passed in.
 *
 * The products are written here, not fetched, so Decide cannot load them from
 * the live catalog.
 */
import type { CatalogProduct, CatalogVariant, Comparison, Shortlist } from "@/pica/lib/types";

const SELLERS = {
  north: { id: "gid://shopify/Shop/seed-1", name: "North Trail Supply", domain: "north-trail.example", links: [] },
  harbor: { id: "gid://shopify/Shop/seed-2", name: "Harbor Bags", domain: "harbor-bags.example", links: [] },
  field: { id: "gid://shopify/Shop/seed-3", name: "Fieldwork Goods", domain: "fieldwork.example", links: [] },
};

function usd(dollars: number) {
  return { amount: dollars * 100, currency: "USD" };
}

function product(input: {
  key: string;
  title: string;
  seller: CatalogProduct["seller"];
  dollars: number;
  colors: { label: string; available: boolean | null }[];
  description: string;
  specs: string[];
  rating?: CatalogProduct["rating"];
  at: number;
}): CatalogProduct {
  const variants: CatalogVariant[] = input.colors.map((color, i) => ({
    id: `gid://shopify/ProductVariant/${input.key}-${i + 1}`,
    title: color.label,
    price: usd(input.dollars),
    available: color.available,
    options: [{ name: "Color", label: color.label }],
  }));
  return {
    id: `gid://shopify/p/${input.key}`,
    title: input.title,
    descriptionText: input.description,
    images: [],
    seller: input.seller,
    priceRange: { min: usd(input.dollars), max: usd(input.dollars) },
    rating: input.rating,
    options: [{ name: "Color", values: input.colors }],
    variants,
    summarized: { sellingPoints: [], features: [], specs: input.specs },
    fetchedAt: input.at,
  };
}

/** Four backpacks: commuter, roll-top (sold out), slim (stock unknown), travel. In that order. */
export function demoProducts(at: number): CatalogProduct[] {
  return [
    product({
      key: "seed-commuter",
      title: "Commuter Pack 24L",
      seller: SELLERS.north,
      dollars: 129,
      colors: [
        { label: "Black", available: true },
        { label: "Olive", available: true },
      ],
      description: "Padded sleeve fits laptops up to 16 inches. Water-resistant recycled nylon. Weighs 1.1 kg.",
      specs: ["24 litres", "Laptop sleeve up to 16 in"],
      rating: { value: 4.6, count: 212, scaleMax: 5 },
      at,
    }),
    product({
      key: "seed-roll-top",
      title: "Roll-Top Day Pack",
      seller: SELLERS.harbor,
      dollars: 98,
      colors: [
        { label: "Grey", available: false },
        { label: "Navy", available: false },
      ],
      description: "Roll-top closure with a side zip. Fits a 15-inch laptop. Waxed canvas.",
      specs: ["20 to 26 litres", "Laptop sleeve up to 15 in"],
      rating: { value: 4.3, count: 41, scaleMax: 5 },
      at,
    }),
    product({
      key: "seed-slim",
      title: "Slim Laptop Backpack",
      seller: SELLERS.field,
      dollars: 74,
      colors: [{ label: "Charcoal", available: null }],
      description: "Slim profile for a 14-inch laptop. Two outside pockets.",
      specs: ["16 litres"],
      at,
    }),
    product({
      key: "seed-travel",
      title: "Travel Pack 30L",
      seller: SELLERS.north,
      dollars: 165,
      colors: [
        { label: "Black", available: true },
        { label: "Sand", available: false },
      ],
      description: "Opens flat like a suitcase. Laptop sleeve fits 16 inches. Stows its straps for checked bags.",
      specs: ["30 litres", "Laptop sleeve up to 16 in"],
      rating: { value: 4.8, count: 9, scaleMax: 5 },
      at,
    }),
  ];
}

/** The shortlist of all four, as `demoProducts` returns them. */
export function demoShortlist(products: CatalogProduct[], at: number): Shortlist {
  const [commuter, rollTop, slim, travel] = products;
  return {
    note: "All four fit the laptop or come close. If your current bag still works, waiting is a fair choice too.",
    createdAt: at,
    stale: false,
    entries: [
      {
        productId: commuter.id,
        angle: "The water-resistant one",
        whyItFits: ["The listing says it fits laptops up to 16 inches.", "Water-resistant nylon covers the rain guess."],
        whyNot: ["At 1.1 kg it is heavier than the slim pack."],
        valueNote: "Costs $55 more than the slim pack, which won't take your laptop.",
        unverified: ["How the straps feel after 30 minutes."],
      },
      {
        productId: rollTop.id,
        angle: "The roll-top",
        whyItFits: ["The roll-top keeps rain out of the main space."],
        whyNot: ["The listing says 15 inches, short of your laptop.", "Sold out in both colours right now."],
        valueNote: "The lowest price of the bags that come close on size.",
        unverified: ["Whether a 16-inch laptop squeezes in."],
      },
      {
        productId: slim.id,
        angle: "The lightest and cheapest",
        whyItFits: ["Well under your budget."],
        whyNot: ["Made for a 14-inch laptop, so yours won't fit."],
        valueNote: "Saves money, but misses your main need.",
        unverified: ["Stock: the merchant doesn't say."],
      },
      {
        productId: travel.id,
        angle: "The one for trips too",
        whyItFits: ["Fits a 16-inch laptop.", "Opens flat for packing."],
        whyNot: ["$165 is over your $150 limit.", "Only 9 ratings so far."],
        valueNote: "You pay $36 more than the commuter pack for travel features.",
        unverified: ["How it carries when half full."],
      },
    ],
  };
}

/** The products `demoComparison` weighs: commuter, roll-top and travel. */
export function demoComparedProducts(products: CatalogProduct[]): CatalogProduct[] {
  const [commuter, rollTop, , travel] = products;
  return [commuter, rollTop, travel];
}

/** Commuter, roll-top and travel, side by side on three needs. */
export function demoComparison(products: CatalogProduct[], at: number): Comparison {
  const [commuter, rollTop, travel] = demoComparedProducts(products);
  return {
    productIds: [commuter.id, rollTop.id, travel.id],
    createdAt: at,
    stale: false,
    takeaway: "The commuter pack fits and stays in budget; the travel pack fits but costs more; the roll-top may not fit.",
    rows: [
      {
        priority: "Fits a 16-inch laptop",
        cells: [
          { productId: commuter.id, note: "Yes, up to 16 inches", basis: "merchant", quote: "fits laptops up to 16 inches" },
          { productId: rollTop.id, note: "Up to 15 inches", basis: "merchant", quote: "Fits a 15-inch laptop" },
          { productId: travel.id, note: "Yes, 16 inches", basis: "merchant", quote: "Laptop sleeve fits 16 inches" },
        ],
      },
      {
        priority: "Holds up in rain",
        cells: [
          { productId: commuter.id, note: "Water-resistant nylon", basis: "merchant", quote: "Water-resistant recycled nylon" },
          { productId: rollTop.id, note: "Waxed canvas and a roll-top should shed rain", basis: "inference" },
          { productId: travel.id, note: "The listing doesn't say", basis: "missing" },
        ],
      },
      {
        priority: "Comfortable for a 30-minute walk",
        cells: [
          { productId: commuter.id, note: "Not stated", basis: "missing" },
          { productId: rollTop.id, note: "Not stated", basis: "missing" },
          { productId: travel.id, note: "24 to 30 litres, so it may ride low when full", basis: "catalog_summary", quote: "30 litres" },
        ],
      },
    ],
  };
}
