import { searchCatalog } from "@/pica/lib/shopify";
import { badRequest, errorResponse, okResponse, readJson, searchParamsSchema } from "@/pica/lib/shopify/api";
import { catalogRouteLimiter, overLimit } from "@/pica/lib/shopify/rate-limit";
import type { CatalogSearchResult } from "@/pica/lib/types";

/** POST /api/catalog/search — body: CatalogSearchParams → CatalogSearchResult */
export async function POST(request: Request) {
  const limited = overLimit(catalogRouteLimiter, request.headers);
  if (limited) return limited;
  const parsed = searchParamsSchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest();
  try {
    const result: CatalogSearchResult = await searchCatalog(parsed.data);
    return okResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
