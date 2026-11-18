/**
 * Input schemas and response helpers shared by the catalog and checkout
 * routes. Server-only.
 */
import { z } from "zod";
import type { ApiError, Category } from "@/pica/lib/types";
import { CATEGORIES } from "@/pica/lib/types";
import { shopifyError, statusForCode, toShopifyError } from "./errors";

const categoryEnum = z.enum(CATEGORIES as unknown as [Category, ...Category[]]);
const usd = z.number().finite().min(0).max(100_000);

export const searchParamsSchema = z
  .object({
    query: z.string().trim().max(200),
    category: categoryEnum.optional(),
    minPriceUsd: usd.optional(),
    maxPriceUsd: usd.optional(),
    cursor: z.string().min(1).max(2000).optional(),
    limit: z.number().int().min(1).max(10).optional(),
  })
  .refine((p) => p.query.length > 0 || p.category !== undefined, { path: ["query"] })
  .refine(
    (p) => p.minPriceUsd === undefined || p.maxPriceUsd === undefined || p.minPriceUsd <= p.maxPriceUsd,
    { path: ["minPriceUsd"] },
  );

export const selectedSchema = z
  .array(z.object({ name: z.string().min(1).max(100), label: z.string().min(1).max(200) }))
  .max(10);

export const productQuerySchema = z.object({
  id: z.string().regex(/^gid:\/\/shopify\/p\/[A-Za-z0-9]+$/),
  selected: selectedSchema.optional(),
});

export const checkoutRequestSchema = z.object({
  productId: z.string().regex(/^gid:\/\/shopify\/p\/[A-Za-z0-9]+$/),
  variantId: z.string().regex(/^gid:\/\/shopify\/ProductVariant\/\d+$/),
  quantity: z.number().int().min(1).max(10),
  sellerDomain: z.string().max(255).optional(),
  checkoutUrl: z.string().max(4000).optional(),
});

/** `{ error: ApiError }` with the status that fits the code. */
export function errorResponse(err: unknown): Response {
  const { error } = toShopifyError(err);
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (error.retryAfterSeconds !== undefined) headers["Retry-After"] = String(error.retryAfterSeconds);
  return Response.json({ error } satisfies { error: ApiError }, {
    status: statusForCode(error.code),
    headers,
  });
}

export function badRequest(): Response {
  return errorResponse(shopifyError("bad_request"));
}

export function okResponse(body: unknown): Response {
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}

/** Read a JSON body. Undefined when the body is not JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

// Each part 0-255 with no leading zero, so "010.0.0.1" (octal to some parsers) is not an IP.
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HEXTET = /^[0-9a-f]{1,4}$/i;

/**
 * The buyer's IP: the first entry of `x-forwarded-for`, when it is a public
 * address. Local, private, reserved and documentation addresses give null,
 * so checkout falls back to the direct link instead of sending Shopify an
 * address that says nothing about the buyer. An IPv6 form that carries an
 * IPv4 address comes back as that IPv4 address, dotted.
 *
 * Off a trusted platform the client writes `x-forwarded-for` itself, so this
 * is the address the client claims. This build assumes no trusted proxy
 * (the same note as the route limiter in rate-limit.ts).
 */
export function buyerIpFrom(headers: Headers): string | null {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!first) return null;
  const ip = parseIp(first);
  if (!ip) return null;
  if (ip.kind === "v4") return isLocalIpv4(ip.octets) ? null : ip.text;
  return isPublicIpv6(ip.hextets) ? first : null;
}

export type ParsedIp = { kind: "v4"; octets: number[]; text: string } | { kind: "v6"; hextets: number[] };

/**
 * Parse an IPv4 or IPv6 address. IPv6 forms that carry an IPv4 address
 * (mapped ::ffff:a.b.c.d, translated ::ffff:0:a.b.c.d, compatible ::a.b.c.d
 * and NAT64 64:ff9b::/96) come back as that IPv4 address. Null when the text
 * is not an address.
 */
export function parseIp(text: string): ParsedIp | null {
  if (text.length > 45) return null;
  if (IPV4.test(text)) return { kind: "v4", octets: ipv4Octets(text), text };
  const hextets = ipv6Hextets(text);
  if (!hextets) return null;
  const carried = carriedIpv4(hextets);
  if (carried) return { kind: "v4", octets: carried, text: carried.join(".") };
  return { kind: "v6", hextets };
}

function ipv4Octets(ip: string): number[] {
  return ip.split(".").map(Number);
}

/**
 * Not a public address: this network (0/8), private (10/8, 172.16/12,
 * 192.168/16), carrier NAT (100.64/10), loopback (127/8), link-local
 * (169.254/16), protocol use (192.0.0/24), benchmarking (198.18/15),
 * documentation (192.0.2/24, 198.51.100/24, 203.0.113/24), the old 6to4
 * relay (192.88.99/24), and multicast or reserved (224 and up).
 */
function isLocalIpv4([a, b, c]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

/** The IPv4 address held in two 16-bit groups. */
function embeddedIpv4(hi: number, lo: number): number[] {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
}

/** The IPv4 address an IPv6 form carries in its last 32 bits, or null. */
function carriedIpv4(h: number[]): number[] | null {
  const zeros = (from: number, to: number) => h.slice(from, to).every((x) => x === 0);
  const carries =
    zeros(0, 6) ||
    (zeros(0, 5) && h[5] === 0xffff) ||
    (zeros(0, 4) && h[4] === 0xffff && h[5] === 0) ||
    (h[0] === 0x64 && h[1] === 0xff9b && zeros(2, 6));
  return carries ? embeddedIpv4(h[6], h[7]) : null;
}

/**
 * An allow rule for IPv6 that carries no IPv4 address: global unicast
 * 2000::/3 only, less documentation (2001:db8::/32 and 3fff::/20) and IETF
 * protocol space (2001::/23). 6to4 (2002::/16) follows the rules for the
 * IPv4 address it holds. Everything outside 2000::/3 (local, link-local,
 * multicast, discard, local-use NAT64 64:ff9b:1::/48) is not public.
 */
function isPublicIpv6(h: number[]): boolean {
  if ((h[0] & 0xe000) !== 0x2000) return false;
  if (h[0] === 0x2002) return !isLocalIpv4(embeddedIpv4(h[1], h[2]));
  if (h[0] === 0x2001 && (h[1] === 0xdb8 || h[1] < 0x200)) return false;
  if (h[0] === 0x3fff && h[1] < 0x1000) return false;
  return true;
}

/** The eight 16-bit groups of an IPv6 address, or null when it is not one. */
export function ipv6Hextets(ip: string): number[] | null {
  if (!ip.includes(":")) return null;
  let text = ip;
  // Rewrite a trailing dotted IPv4 part (as in ::ffff:10.0.0.1) as two hex groups.
  const lastColon = text.lastIndexOf(":");
  const last = text.slice(lastColon + 1);
  if (last.includes(".")) {
    if (!IPV4.test(last)) return null;
    const [a, b, c, d] = ipv4Octets(last);
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string): number[] | null => {
    if (part === "") return [];
    const groups = part.split(":");
    return groups.every((g) => HEXTET.test(g)) ? groups.map((g) => parseInt(g, 16)) : null;
  };
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  if (!head || !tail) return null;
  const known = head.length + tail.length;
  if (halves.length === 1) return known === 8 ? head : null;
  return known <= 7 ? [...head, ...new Array<number>(8 - known).fill(0), ...tail] : null;
}
