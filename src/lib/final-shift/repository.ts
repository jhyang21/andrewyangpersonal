import { getSql } from "@/lib/final-shift/db";
import type {
  DateOption,
  DraftValues,
  EventConfig,
  Submission,
} from "@/lib/final-shift/types";

/*
 * ★ VENDOR SEAM.
 *
 * The only module in the feature that imports db.ts. Route handlers import this and storage.ts and
 * nothing else data-shaped, so moving off Supabase Postgres later is a rewrite of exactly two files
 * rather than an archaeology project across eight route handlers.
 *
 * Everything here returns the camelCase types from types.ts, never raw rows — the snake_case column
 * names stop at this boundary.
 */

export type GuestRow = {
  id: string;
  firstName: string;
  crewRole: string;
  isActive: boolean;
};

export type PhotoRow = {
  path: string;
  width: number;
  height: number;
} | null;

/** A submission as stored: the same shape the client sees, minus the signed photo URL. */
export type StoredSubmission = Omit<Submission, "photo"> & { photo: PhotoRow };

export type WallRow = {
  id: string;
  guestId: string;
  firstName: string;
  caption: string | null;
  memory: string | null;
  photoPath: string | null;
  photoWidth: number | null;
  photoHeight: number | null;
};

export async function getEventConfig(): Promise<EventConfig> {
  const sql = getSql();
  const [row] = await sql<
    {
      event_name: string;
      subtitle: string;
      contact_line: string;
      date_options: DateOption[];
      dietary_chips: string[];
      wall_enabled: boolean;
      edits_locked: boolean;
    }[]
  >`
    SELECT event_name, subtitle, contact_line, date_options, dietary_chips,
           wall_enabled, edits_locked
    FROM fs_event_config
    WHERE id = 1
  `;

  if (!row) throw new Error("fs_event_config row 1 is missing. Run the seed script.");

  return {
    eventName: row.event_name,
    subtitle: row.subtitle,
    contactLine: row.contact_line,
    // Ordering lives on the ISO timestamp, never on the prose label.
    dateOptions: [...row.date_options].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    dietaryChips: row.dietary_chips,
    wallEnabled: row.wall_enabled,
    editsLocked: row.edits_locked,
  };
}

export async function findGuestByCodeHash(codeHash: string): Promise<GuestRow | null> {
  const sql = getSql();
  const [row] = await sql<
    { id: string; first_name: string; crew_role: string; is_active: boolean }[]
  >`
    SELECT id, first_name, crew_role, is_active
    FROM fs_guests
    WHERE code_hash = ${codeHash}
  `;
  return row
    ? {
        id: row.id,
        firstName: row.first_name,
        crewRole: row.crew_role,
        isActive: row.is_active,
      }
    : null;
}

export async function getGuestById(guestId: string): Promise<GuestRow | null> {
  const sql = getSql();
  const [row] = await sql<
    { id: string; first_name: string; crew_role: string; is_active: boolean }[]
  >`
    SELECT id, first_name, crew_role, is_active
    FROM fs_guests
    WHERE id = ${guestId}
  `;
  return row
    ? {
        id: row.id,
        firstName: row.first_name,
        crewRole: row.crew_role,
        isActive: row.is_active,
      }
    : null;
}

/**
 * The private note, fetched on its own.
 *
 * Never joined into the clock-in response. The note is the last beat of the ceremony and it is
 * personal; shipping it to the browser at stage 1 would put it in the network tab of anyone who
 * knows a code, twenty minutes before the guest is meant to read it.
 */
export async function getPrivateNote(guestId: string): Promise<string | null> {
  const sql = getSql();
  const [row] = await sql<{ private_note: string | null }[]>`
    SELECT private_note FROM fs_guests WHERE id = ${guestId}
  `;
  return row?.private_note ?? null;
}

type SubmissionRow = {
  status: "draft" | "submitted";
  attending: boolean | null;
  available_dates: string[];
  dietary_tags: string[];
  dietary_note: string | null;
  photo_path: string | null;
  photo_width: number | null;
  photo_height: number | null;
  caption: string | null;
  memory: string | null;
  wall_consent: boolean;
  submitted_at: Date | null;
};

function toSubmission(row: SubmissionRow): StoredSubmission {
  return {
    status: row.status,
    attending: row.attending,
    availableDates: row.available_dates,
    dietaryTags: row.dietary_tags,
    dietaryNote: row.dietary_note ?? "",
    photo: row.photo_path
      ? {
          path: row.photo_path,
          width: row.photo_width ?? 0,
          height: row.photo_height ?? 0,
        }
      : null,
    caption: row.caption ?? "",
    memory: row.memory ?? "",
    wallConsent: row.wall_consent,
    submittedAt: row.submitted_at ? row.submitted_at.toISOString() : null,
  };
}

/*
 * The RETURNING list is spelled out in each statement rather than hoisted into a shared fragment.
 * postgres.js can splice fragments, but a mis-spliced RETURNING fails at runtime against a real
 * database and nowhere earlier, and this is the layer where nothing is worth being clever about.
 */

/**
 * Reads the guest's row, creating an empty draft the first time.
 *
 * One row per guest, ever. The draft and the submitted record are the same row — status flips on
 * clock-out and later edits write in place — which is what makes submit idempotent and makes "edit
 * my RSVP" structurally a no-op rather than a second code path.
 */
export async function ensureSubmission(guestId: string): Promise<StoredSubmission> {
  const sql = getSql();
  const [row] = await sql<SubmissionRow[]>`
    INSERT INTO fs_submissions (guest_id)
    VALUES (${guestId})
    ON CONFLICT (guest_id) DO UPDATE SET guest_id = EXCLUDED.guest_id
    RETURNING status, attending, available_dates, dietary_tags, dietary_note,
              photo_path, photo_width, photo_height, caption, memory,
              wall_consent, submitted_at
  `;
  return toSubmission(row);
}

/**
 * Writes whichever draft fields were sent, leaving the rest alone.
 *
 * COALESCE against a null parameter is what makes the patch partial: a field the client didn't send
 * arrives as null and the CASE keeps the stored value. Do not "simplify" this into assigning every
 * column — a PATCH that only carried the caption would then wipe the dates.
 */
export async function patchDraft(
  guestId: string,
  patch: Partial<DraftValues>,
): Promise<StoredSubmission> {
  const sql = getSql();
  const [row] = await sql<SubmissionRow[]>`
    UPDATE fs_submissions SET
      attending       = ${patch.attending === undefined ? sql`attending` : patch.attending},
      available_dates = ${patch.availableDates ?? sql`available_dates`},
      dietary_tags    = ${patch.dietaryTags ?? sql`dietary_tags`},
      dietary_note    = ${patch.dietaryNote ?? sql`dietary_note`},
      caption         = ${patch.caption ?? sql`caption`},
      memory          = ${patch.memory ?? sql`memory`},
      wall_consent    = ${patch.wallConsent === undefined ? sql`wall_consent` : patch.wallConsent},
      updated_at      = NOW()
    WHERE guest_id = ${guestId}
    RETURNING status, attending, available_dates, dietary_tags, dietary_note,
              photo_path, photo_width, photo_height, caption, memory,
              wall_consent, submitted_at
  `;
  return toSubmission(row);
}

/**
 * Records a newly committed photo and hands back the one it replaced.
 *
 * The caller deletes the old object. Returning the path rather than deleting it here keeps storage
 * calls out of the repository, which is the whole point of the two seams being separate.
 *
 * The previous path is read in its own statement, before the update. Reading it from a subquery
 * inside RETURNING would depend on which snapshot that subquery sees — true today, and exactly the
 * kind of thing that quietly starts returning the *new* path after a version bump and orphans every
 * replaced photo in the bucket.
 */
export async function setPhoto(
  guestId: string,
  photo: { path: string; width: number; height: number; bytes: number },
): Promise<{ submission: StoredSubmission; previousPath: string | null }> {
  const sql = getSql();

  const [existing] = await sql<{ photo_path: string | null }[]>`
    SELECT photo_path FROM fs_submissions WHERE guest_id = ${guestId}
  `;

  const [row] = await sql<SubmissionRow[]>`
    UPDATE fs_submissions SET
      photo_path   = ${photo.path},
      photo_width  = ${photo.width},
      photo_height = ${photo.height},
      photo_bytes  = ${photo.bytes},
      updated_at   = NOW()
    WHERE guest_id = ${guestId}
    RETURNING status, attending, available_dates, dietary_tags, dietary_note,
              photo_path, photo_width, photo_height, caption, memory,
              wall_consent, submitted_at
  `;

  return { submission: toSubmission(row), previousPath: existing?.photo_path ?? null };
}

/**
 * Flips the row to submitted, once.
 *
 * `COALESCE(submitted_at, NOW())` is what makes this idempotent: a returning guest saving an edit
 * keeps their original clock-out time, so the wall's ordering doesn't reshuffle every time somebody
 * fixes a typo, and "when did you RSVP" stays a true answer.
 */
export async function markSubmitted(guestId: string): Promise<StoredSubmission> {
  const sql = getSql();
  const [row] = await sql<SubmissionRow[]>`
    UPDATE fs_submissions SET
      status       = 'submitted',
      submitted_at = COALESCE(submitted_at, NOW()),
      updated_at   = NOW()
    WHERE guest_id = ${guestId}
    RETURNING status, attending, available_dates, dietary_tags, dietary_note,
              photo_path, photo_width, photo_height, caption, memory,
              wall_consent, submitted_at
  `;
  return toSubmission(row);
}

/**
 * The farewell wall.
 *
 * The column list is explicit and must stay that way. `SELECT *` here would ship code_hash,
 * attending, dietary answers, available dates, and the private note to every guest on the wall the
 * moment someone adds a column — this is the single query where a careless edit is a real
 * disclosure, so the fields that must never appear are named in the comment as well as absent from
 * the SQL: code_hash, attending, dietary_tags, dietary_note, available_dates, private_note.
 *
 * There is deliberately no count anywhere in this path either. At under ten guests, a total is an
 * inference: seven cards against a group everyone knows is about ten tells the room that three
 * people either declined the wall or haven't replied, which identifies the holdouts by elimination.
 */
export async function getWallCards(): Promise<WallRow[]> {
  const sql = getSql();
  return sql<WallRow[]>`
    SELECT s.id AS "id",
           s.guest_id AS "guestId",
           g.first_name AS "firstName",
           s.caption AS "caption",
           s.memory AS "memory",
           s.photo_path AS "photoPath",
           s.photo_width AS "photoWidth",
           s.photo_height AS "photoHeight"
    FROM fs_submissions s
    JOIN fs_guests g ON g.id = s.guest_id
    WHERE s.status = 'submitted'
      AND s.wall_consent = true
      AND (s.photo_path IS NOT NULL OR s.memory IS NOT NULL)
    ORDER BY s.submitted_at DESC
  `;
}

export type AdminRow = {
  guestId: string;
  firstName: string;
  crewRole: string;
  hasPrivateNote: boolean;
  status: "draft" | "submitted" | null;
  attending: boolean | null;
  availableDates: string[] | null;
  dietaryTags: string[] | null;
  dietaryNote: string | null;
  photoPath: string | null;
  caption: string | null;
  memory: string | null;
  wallConsent: boolean | null;
  submittedAt: Date | null;
};

/**
 * Everything, for Andrew.
 *
 * A LEFT JOIN, not an inner one, because the roster coverage check needs the guests who have never
 * clocked in — the people worth a text message — and an inner join would silently drop exactly
 * those rows.
 */
export async function getAdminRows(): Promise<AdminRow[]> {
  const sql = getSql();
  return sql<AdminRow[]>`
    SELECT g.id AS "guestId",
           g.first_name AS "firstName",
           g.crew_role AS "crewRole",
           (g.private_note IS NOT NULL AND g.private_note <> '') AS "hasPrivateNote",
           s.status AS "status",
           s.attending AS "attending",
           s.available_dates AS "availableDates",
           s.dietary_tags AS "dietaryTags",
           s.dietary_note AS "dietaryNote",
           s.photo_path AS "photoPath",
           s.caption AS "caption",
           s.memory AS "memory",
           s.wall_consent AS "wallConsent",
           s.submitted_at AS "submittedAt"
    FROM fs_guests g
    LEFT JOIN fs_submissions s ON s.guest_id = g.id
    WHERE g.is_active = true
    ORDER BY g.first_name ASC
  `;
}
