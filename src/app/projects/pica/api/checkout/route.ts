import { createCheckout } from "@/pica/lib/shopify";
import {
  badRequest,
  buyerIpFrom,
  checkoutRequestSchema,
  errorResponse,
  okResponse,
  readJson,
} from "@/pica/lib/shopify/api";
import { checkoutRouteLimiter, overLimit } from "@/pica/lib/shopify/rate-limit";
import type { CheckoutResponse } from "@/pica/lib/types";

/**
 * POST /api/checkout — body: CheckoutRequest → CheckoutResponse.
 * Starts a checkout only; the buyer finishes and pays at the merchant.
 * Never log the response: it holds the checkout link.
 */
export async function POST(request: Request) {
  const limited = overLimit(checkoutRouteLimiter, request.headers);
  if (limited) return limited;
  const parsed = checkoutRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest();
  try {
    const result: CheckoutResponse = await createCheckout(parsed.data, buyerIpFrom(request.headers));
    return okResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
