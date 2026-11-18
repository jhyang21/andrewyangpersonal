/**
 * Turn raw UCP catalog records into `CatalogProduct`. Pure functions, no I/O.
 *
 * Rules: keep only USD prices; copy URLs byte-for-byte and keep only https
 * ones; leave a field out (or null) when the catalog omits it. Never invent.
 */
import type {
  CatalogImage,
  CatalogOption,
  CatalogProduct,
  CatalogSeller,
  CatalogVariant,
  Money,
} from "@/pica/lib/types";
import { CURRENCY } from "./config";
import { isRecord } from "./transport";

/* ------------------------------ text ------------------------------ */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  bull: "•",
  middot: "·",
  deg: "°",
  times: "×",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  trade: "™",
  reg: "®",
  copy: "©",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  ntilde: "ñ",
  prime: "′",
  Prime: "″",
};

/** Decode HTML entities. Unknown named entities stay as written. */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

const BLOCK_TAG =
  /<\/?(?:p|div|br|li|ul|ol|h[1-6]|tr|td|th|table|tbody|thead|section|article|header|footer|blockquote|hr|dd|dt|dl)\b[^>]*>/gi;

/** Most rounds of entity decoding we run. Real listings need two at most. */
const MAX_DECODE_ROUNDS = 5;

/**
 * The catalog's `description.plain` is HTML, sometimes entity-escaped once or
 * more (`&lt;p&gt;`, `&amp;lt;p&amp;gt;`). Decode until nothing changes, then
 * drop tags (and script/style bodies), and collapse spaces. Block elements
 * become line breaks so list items stay apart. We never decode after the
 * strip, so an escaped tag cannot come back to life as a real one.
 */
export function htmlToText(input: string): string {
  let text = input;
  for (let round = 0; round < MAX_DECODE_ROUNDS; round++) {
    const next = decodeEntities(text);
    if (next === text) break;
    text = next;
  }
  text = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(BLOCK_TAG, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "");
  return text
    .replace(/ /g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/* ---------------------------- fields ---------------------------- */

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Keep a URL only if it parses and uses https. Returns the original string, unchanged. */
export function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Money in USD minor units, or undefined for any other currency or a bad amount. */
export function usdMoney(value: unknown): Money | undefined {
  if (!isRecord(value)) return undefined;
  const amount = num(value.amount);
  if (amount === undefined || !Number.isInteger(amount) || amount < 0) return undefined;
  if (value.currency !== CURRENCY) return undefined;
  return { amount, currency: CURRENCY };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
}

function image(value: unknown): CatalogImage | undefined {
  if (!isRecord(value)) return undefined;
  if (value.type !== undefined && value.type !== "image") return undefined;
  const url = httpsUrl(value.url);
  if (!url) return undefined;
  const img: CatalogImage = { url, alt: str(value.alt_text) ?? "" };
  const width = num(value.width);
  const height = num(value.height);
  if (width !== undefined) img.width = width;
  if (height !== undefined) img.height = height;
  return img;
}

function images(value: unknown): CatalogImage[] {
  if (!Array.isArray(value)) return [];
  return value.map(image).filter((i): i is CatalogImage => i !== undefined);
}

function seller(value: unknown): CatalogSeller | undefined {
  if (!isRecord(value)) return undefined;
  const id = str(value.id);
  const name = str(value.name);
  if (!id || !name) return undefined;
  const out: CatalogSeller = {
    id,
    name,
    links: Array.isArray(value.links)
      ? value.links.flatMap((l) => {
          if (!isRecord(l)) return [];
          const type = str(l.type);
          const url = httpsUrl(l.url);
          return type && url ? [{ type, url }] : [];
        })
      : [],
  };
  const url = httpsUrl(value.url);
  if (url) out.url = url;
  const domain = str(value.domain);
  if (domain) out.domain = domain;
  return out;
}

function options(value: unknown): CatalogOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((o) => {
    if (!isRecord(o)) return [];
    const name = str(o.name);
    if (!name || !Array.isArray(o.values)) return [];
    const values = o.values.flatMap((v) => {
      if (!isRecord(v)) return [];
      const label = str(v.label);
      if (!label) return [];
      // `exists: false` means no variant has this value with the current selection.
      const available = v.exists === false ? false : typeof v.available === "boolean" ? v.available : null;
      return [{ label, available }];
    });
    return [{ name, values }];
  });
}

/** Normalize one variant. Undefined when it has no id or no USD price. */
export function normalizeVariant(value: unknown): CatalogVariant | undefined {
  if (!isRecord(value)) return undefined;
  const id = str(value.id);
  const price = usdMoney(value.price);
  if (!id || !price) return undefined;
  const availability = isRecord(value.availability) ? value.availability.available : undefined;
  const variant: CatalogVariant = {
    id,
    title: str(value.title) ?? "",
    price,
    available: typeof availability === "boolean" ? availability : null,
    options: Array.isArray(value.options)
      ? value.options.flatMap((o) => {
          if (!isRecord(o)) return [];
          const name = str(o.name);
          const label = str(o.label);
          return name && label ? [{ name, label }] : [];
        })
      : [],
  };
  const listPrice = usdMoney(value.list_price);
  if (listPrice) variant.listPrice = listPrice;
  const url = httpsUrl(value.url);
  if (url) variant.url = url;
  const checkoutUrl = httpsUrl(value.checkout_url);
  if (checkoutUrl) variant.checkoutUrl = checkoutUrl;
  const img = Array.isArray(value.media) ? images(value.media)[0] : undefined;
  if (img) variant.image = img;
  return variant;
}

/** The seller sits on each variant in the catalog. Take it from the first one that has it. */
function sellerFromVariants(rawVariants: unknown[]): CatalogSeller | undefined {
  for (const v of rawVariants) {
    if (isRecord(v)) {
      const s = seller(v.seller);
      if (s) return s;
    }
  }
  return undefined;
}

function rating(value: unknown): CatalogProduct["rating"] {
  if (!isRecord(value)) return undefined;
  const v = num(value.value);
  const count = num(value.count);
  const scaleMax = num(value.scale_max);
  if (v === undefined || count === undefined || scaleMax === undefined || count <= 0) return undefined;
  return { value: v, count, scaleMax };
}

/**
 * Normalize one product. Returns null when the product cannot be shown
 * honestly: not priced in USD, no USD variant, or no seller.
 */
export function normalizeProduct(value: unknown, fetchedAt: number): CatalogProduct | null {
  if (!isRecord(value)) return null;
  const id = str(value.id);
  const title = str(value.title);
  if (!id || !title) return null;

  const range = isRecord(value.price_range) ? value.price_range : undefined;
  const min = usdMoney(range?.min);
  const max = usdMoney(range?.max);
  if (!min || !max) return null;

  const rawVariants = Array.isArray(value.variants) ? value.variants : [];
  const variants = rawVariants.map(normalizeVariant).filter((v): v is CatalogVariant => v !== undefined);
  if (variants.length === 0) return null;

  const sellerInfo = sellerFromVariants(rawVariants);
  if (!sellerInfo) return null;

  const description = isRecord(value.description) ? str(value.description.plain) : undefined;
  const metadata = isRecord(value.metadata) ? value.metadata : {};

  const product: CatalogProduct = {
    id,
    title: decodeEntities(title).trim(),
    descriptionText: description ? htmlToText(description) : "",
    images: images(value.media),
    seller: sellerInfo,
    priceRange: { min, max },
    options: options(value.options),
    variants,
    summarized: {
      sellingPoints: stringList(metadata.unique_selling_points),
      features: stringList(metadata.top_features),
      specs: stringList(metadata.tech_specs),
    },
    fetchedAt,
  };
  const r = rating(value.rating);
  if (r) product.rating = r;
  return product;
}

/** Normalize a list and drop the ones that fail the rules above. */
export function normalizeProducts(values: unknown, fetchedAt: number): CatalogProduct[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => normalizeProduct(v, fetchedAt))
    .filter((p): p is CatalogProduct => p !== null);
}
