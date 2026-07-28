import { getAdminRows, getEventConfig } from "@/lib/final-shift/repository";
import { createSignedUrls } from "@/lib/final-shift/storage";
import type { EventConfig } from "@/lib/final-shift/types";

/**
 * One roster entry as Andrew sees it.
 *
 * The private note is not here, only whether it exists. That is the part Andrew needs before the
 * party — a guest with no note gets the fallback copy, and he may want to write them one. The text
 * itself he wrote and can read in Supabase Studio; it has no reason to travel to a browser, least of
 * all all of them at once on a page that might be open on a café laptop.
 */
export type AdminGuest = {
  guestId: string;
  firstName: string;
  crewRole: string;
  hasPrivateNote: boolean;
  /** null when the guest has never clocked in — the LEFT JOIN keeps them. */
  status: "draft" | "submitted" | null;
  attending: boolean | null;
  availableDates: string[];
  dietaryTags: string[];
  dietaryNote: string;
  caption: string;
  memory: string;
  wallConsent: boolean;
  submittedAt: string | null;
  photoUrl: string | null;
};

export type AdminPayload = {
  event: EventConfig;
  guests: AdminGuest[];
};

/**
 * The shared shape, so the page render and the JSON route cannot drift.
 *
 * Same reason as `loadWall`: two callers that each build their own version of a payload is how a
 * field ends up in one and not the other, and here the field that would go missing is the one Andrew
 * plans a party around.
 */
export async function loadAdminPayload(): Promise<AdminPayload> {
  const [rows, event] = await Promise.all([getAdminRows(), getEventConfig()]);

  const paths = rows
    .map((row) => row.photoPath)
    .filter((path): path is string => Boolean(path));
  const signed = await createSignedUrls(paths);

  const guests = rows.map((row) => ({
    guestId: row.guestId,
    firstName: row.firstName,
    crewRole: row.crewRole,
    hasPrivateNote: row.hasPrivateNote,
    status: row.status,
    attending: row.attending,
    availableDates: row.availableDates ?? [],
    dietaryTags: row.dietaryTags ?? [],
    dietaryNote: row.dietaryNote ?? "",
    caption: row.caption ?? "",
    memory: row.memory ?? "",
    wallConsent: row.wallConsent ?? false,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    photoUrl: row.photoPath ? (signed.get(row.photoPath) ?? null) : null,
  }));

  return { event, guests };
}

/**
 * Dates ranked by how many people can make them.
 *
 * Counted from `attending === true` only. A guest who has said they can't come may still have dates
 * ticked from before they changed their answer, and counting those would put Andrew on the wrong
 * Saturday.
 */
export function tallyDates(payload: AdminPayload) {
  return payload.event.dateOptions
    .map((option) => ({
      option,
      names: payload.guests
        .filter(
          (guest) =>
            guest.attending === true && guest.availableDates.includes(option.id),
        )
        .map((guest) => guest.firstName),
    }))
    .sort((a, b) => b.names.length - a.names.length);
}
