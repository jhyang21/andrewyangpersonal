import { redirect } from "next/navigation";
import { FarewellWall } from "@/components/final-shift/FarewellWall";
import { identify } from "@/lib/final-shift/api";
import { ensureSubmission } from "@/lib/final-shift/repository";
import { loadWall } from "@/lib/final-shift/wall";

export const dynamic = "force-dynamic";

/**
 * The wall gets a real route, unlike the seven stages.
 *
 * Different data, different chrome, and no in-progress form state to lose on a remount — plus real
 * deep-link value, because this is the page guests come back to over the weeks between the RSVP and
 * the party. The stages stay on a hash for the opposite reason: they have everything to lose.
 *
 * Rendered on the server so the wall is there on first paint. A client fetch would mean a spinner
 * on the one screen whose whole job is to feel like arriving somewhere.
 */
export default async function FarewellWallPage() {
  const identified = await identify();

  // Behind the same gate as everything else. Sending them to the timeclock rather than showing a
  // locked door is the right shape: the code is how you get in, and they may simply be on a new
  // phone.
  if (!identified) redirect("/final-shift");

  const [wall, submission] = await Promise.all([
    loadWall(identified.guest.id, identified.event),
    ensureSubmission(identified.guest.id),
  ]);

  return (
    <FarewellWall
      firstName={identified.guest.firstName}
      // Never returned by the server after clock-in; the note dialog masks it.
      code=""
      enabled={wall.enabled}
      hasSubmitted={submission.status === "submitted"}
      initialCards={wall.cards}
    />
  );
}
