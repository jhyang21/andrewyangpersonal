/**
 * POST /api/events — one analytics event per request.
 * Validates with zod, then writes one JSON line to the server log.
 * Answers 204, or 400 with `{ error }` when the event is malformed.
 */
import { analyticsEventSchema } from "@/pica/lib/analytics/schema";
import type { ApiError } from "@/pica/lib/types";

const MAX_BODY = 4_000;

function badRequest(): Response {
  const error: ApiError = {
    code: "bad_request",
    message: "We couldn't read that event.",
  };
  return Response.json({ error }, { status: 400 });
}

export async function POST(request: Request): Promise<Response> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return badRequest();
  }
  if (text.length === 0 || text.length > MAX_BODY) return badRequest();

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return badRequest();
  }
  const parsed = analyticsEventSchema.safeParse(raw);
  if (!parsed.success) return badRequest();

  console.info(JSON.stringify({ type: "analytics", ...parsed.data, receivedAt: Date.now() }));
  return new Response(null, { status: 204 });
}
