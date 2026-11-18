/** Builders for Pica's tests. Not used by app code. */
import { EMPTY_CANVAS, type CatalogProduct, type ChatSessionContext } from "@/pica/lib/types";

export function makeProduct(overrides: Partial<CatalogProduct> & { id: string }): CatalogProduct {
  return {
    title: "Slim Commuter Backpack",
    descriptionText:
      "Water-repellent nylon with a padded 16 inch laptop pocket. See https://example-shop.com/care for care tips.",
    images: [{ url: "https://cdn.shopify.com/s/files/backpack.jpg", alt: "Backpack" }],
    seller: {
      id: "gid://shopify/Shop/1",
      name: "Trail Goods",
      url: "https://trailgoods.example",
      domain: "trailgoods.myshopify.com",
      links: [{ type: "refund", url: "https://trailgoods.example/refunds" }],
    },
    priceRange: {
      min: { amount: 12900, currency: "USD" },
      max: { amount: 12900, currency: "USD" },
    },
    rating: { value: 4.6, count: 120, scaleMax: 5 },
    options: [{ name: "Color", values: [{ label: "Black", available: true }] }],
    variants: [
      {
        id: `${overrides.id}-v1`,
        title: "Black",
        price: { amount: 12900, currency: "USD" },
        available: true,
        options: [{ name: "Color", label: "Black" }],
        url: "https://trailgoods.example/products/slim?variant=1&utm_source=shop",
        checkoutUrl: "https://trailgoods.example/cart/1:1",
        image: { url: "https://cdn.shopify.com/s/files/backpack-black.jpg", alt: "Black" },
      },
    ],
    summarized: {
      sellingPoints: ["Light for daily commutes."],
      features: ["Padded laptop sleeve", "Bottle pocket"],
      specs: ["Material: Nylon", "Capacity: 15 L"],
    },
    fetchedAt: 1_700_000_000_000,
    ...overrides,
  };
}

export function makeSession(overrides: Partial<ChatSessionContext> = {}): ChatSessionContext {
  return {
    sessionId: "test-session",
    canvas: EMPTY_CANVAS,
    products: [],
    shortlistProductIds: [],
    canvasChangedSinceShortlist: false,
    ...overrides,
  };
}
