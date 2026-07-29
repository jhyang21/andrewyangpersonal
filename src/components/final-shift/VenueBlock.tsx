import { COPY } from "@/lib/final-shift/copy";
import type { EventConfig } from "@/lib/final-shift/types";

/**
 * Where the party is. Rendered on the RSVP screen and again on the clocked-out screen.
 *
 * One component for both because they must not drift: the address a guest reads while deciding has
 * to be the address they read again the night of the party, and two hand-written copies of the same
 * three fields is how that stops being true.
 *
 * On the RSVP screen it sits above the yes/no cards rather than inside the attending branch, which
 * is a deliberate exception to the rule that governs dates and dietary. Those are removed from the
 * DOM for a guest who declines because they are questions asked of an attendee. This is not a
 * question — it is what the guest needs in order to answer the one the screen is asking.
 *
 * Returns null without a venue name. An event with no room booked yet is a real state, and the
 * address and map link have nothing to hang under without it.
 */
export function VenueBlock({
  event,
  className,
}: {
  event: EventConfig;
  /*
   * Spacing belongs to the caller, but it has to arrive here rather than on a wrapper around this
   * component. A wrapper div carrying `mt-8` still renders — and still pushes everything below it
   * down by 2rem — on an event with no venue, which is exactly the case this component exists to
   * disappear in.
   */
  className?: string;
}) {
  if (!event.venueName) return null;

  return (
    <div className={className}>
      <p className="fs-label text-[var(--fs-oat)]">{COPY.receipt.venueLabel}</p>
      <p className="fs-body mt-1 text-[var(--fs-cream)]">{event.venueName}</p>
      {event.venueAddress ? (
        <p className="fs-meta mt-1 text-[var(--fs-muted-on-espresso)]">{event.venueAddress}</p>
      ) : null}
      {event.venueMapUrl ? (
        /*
         * The new tab is load-bearing, not boilerplate. ShiftMachine holds every stage's state in
         * memory — including the photo blob — so navigating this tab away and coming back would
         * drop the guest at the keypad with their work gone. On a phone the href usually hands off
         * to the Maps app, which backgrounds the browser; the RSVP survives either way.
         *
         * No referrer worry: next.config.ts already sets Referrer-Policy: no-referrer across
         * /final-shift, so tapping out doesn't hand the invite URL to Google.
         *
         * Styled as a link and sized to 44px. It must not read as a second primary action — the
         * screen already has one, and finding the bar is not the thing being asked here.
         */
        <a
          href={event.venueMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fs-label mt-2 inline-flex min-h-11 items-center text-[var(--fs-blue)] underline underline-offset-4"
        >
          {COPY.receipt.venueMapCta}
          <span aria-hidden="true" className="ml-1">
            →
          </span>
        </a>
      ) : null}
    </div>
  );
}
