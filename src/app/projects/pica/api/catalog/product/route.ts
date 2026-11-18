import type { NextRequest } from "next/server";
import { getProduct } from "@/pica/lib/shopify";
import { badRequest, errorResponse, okResponse, productQuerySchema } from "@/pica/lib/shopify/api";
import { catalogRouteLimiter, overLimit } from "@/pica/lib/shopify/rate-limit";

/**
 * GET /api/catalog/product?id=<gid>&selected=<url-encoded JSON array>
 * → { product: CatalogProduct }
 */
export async function GET(request: NextRequest) {
  const limited = overLimit(catalogRouteLimiter, request.headers);
  if (limited) return limited;
  const params = request.nextUrl.searchParams;
  let selected: unknown = undefined;
  const rawSelected = params.get("selected");
  if (rawSelected) {
    try {
      selected = JSON.parse(rawSelected);
    } catch {
      return badRequest();
    }
  }
  const parsed = productQuerySchema.safeParse({ id: params.get("id") ?? "", selected });
  if (!parsed.success) return badRequest();
  try {
    const product = await getProduct(parsed.data.id, parsed.data.selected);
    return okResponse({ product });
  } catch (err) {
    return errorResponse(err);
  }
}
