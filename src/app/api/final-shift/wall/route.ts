import { identify, json, unauthorized } from "@/lib/final-shift/api";
import { loadWall } from "@/lib/final-shift/wall";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The farewell wall.
 *
 * The whole payload — and everything deliberately missing from it — is built in loadWall, which the
 * wall page also uses. See the contract there before changing anything about this shape.
 */
export async function GET(): Promise<Response> {
  const identified = await identify();
  if (!identified) return unauthorized();

  const wall = await loadWall(identified.guest.id, identified.event);
  return json({ ok: true, ...wall });
}
