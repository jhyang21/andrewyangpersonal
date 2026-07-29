import { ShiftMachine } from "@/components/final-shift/ShiftMachine";
import { identify, sessionPayload } from "@/lib/final-shift/api";
import type { SessionPayload } from "@/lib/final-shift/types";

/*
 * Nothing here is cacheable: once the session cookie exists, every render depends on it.
 */
export const dynamic = "force-dynamic";

/**
 * Resolves the cookie before the first paint.
 *
 * Doing this on the server is what stops a returning guest seeing the keypad flash on a cold mobile
 * connection — being asked to identify yourself by a page that already knows who you are is a small
 * thing that undoes the whole conceit.
 *
 * A failure returns null rather than throwing. A paused free-tier Supabase project is a real and
 * likely state here, and the answer to it is a page that still loads and says something, not an
 * error screen. The code is never returned: it arrived once, in the guest's own hands.
 */
async function loadSession(): Promise<SessionPayload | null> {
  try {
    const identified = await identify();
    return identified ? await sessionPayload(identified.guest, "") : null;
  } catch {
    return null;
  }
}

export default async function FinalShiftPage() {
  return <ShiftMachine initialSession={await loadSession()} />;
}
