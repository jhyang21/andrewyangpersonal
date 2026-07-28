# Final Shift — one-time backend setup

Everything below needs an Andrew-only login, which is why it isn't scripted. Fifteen minutes, once.
The secrets that don't need an account are already generated and sitting in `.env.local`.

## 1. Pick the Supabase project

**Use your existing personal-site project.** Nothing here needs a project of its own, and a spare
project is one more thing to remember to delete.

Everything this feature creates lives in a **`final_shift` schema**, not in `public`. That is what
makes it removable in one line when the party is over:

```sql
DROP SCHEMA final_shift CASCADE;
```

No table list to keep in sync, nothing left behind, and nothing of yours touched. Two other things
fall out of it: the tables can't collide with anything the site adds later, and Supabase's
auto-generated REST API only exposes `public`, so none of them are reachable through it at all.

To browse the rows in Studio, use the **schema dropdown** above the table list and switch from
`public` to `final_shift` — otherwise the Table Editor will look empty.

Free tier is fine on volume: ten photos is about 3 MB against a 1 GB allowance. The catch is
different. **A free project pauses after 7 days idle**, and that is a likely shape here — invite
goes out, a quiet week, then a reminder text and a burst of RSVPs that hit a paused database. Either
keep it on a paid plan for the few weeks this runs, or open the dashboard once before each reminder
you send.

## 2. Make the photo bucket

> **Already done** (28 July 2026) — `final-shift-photos` exists on the personal-site project, private,
> 3 MB, `image/jpeg` only, and photos have been uploaded through it end to end. The rest of this
> section is here for the rebuild, not for you today.

**Same project, Storage tab.** Buckets aren't part of any schema — Storage is its own thing — so the
bucket can't hide inside `final_shift`. It stands on its own next to any other buckets you have,
which is fine: it's a separate object with a separate name, and deleting it touches nothing else.
When you tear down, **empty it first, then delete it** — Supabase won't delete a bucket with objects
still in it.

Storage → New bucket:

- Name: `final-shift-photos`
- **Public: off.** Not "off for now" — off. Object paths contain UUIDs, and treating that as
  security means a guest's face is one forwarded URL away from the open internet. Photos are served
  through 15-minute signed URLs minted after the cookie check.
- File size limit: `3 MB`
- Allowed MIME types: `image/jpeg`

The size and MIME limits are a second, independent check. The browser already re-encodes every photo
to JPEG under 3 MB; the bucket enforcing it too is what closes "upload an SVG with a script in it".

## 3. Fill in `.env.local`

Three blanks at the top of the file:

| Variable | Where |
|---|---|
| `POSTGRES_URL` | Settings → Database → Connection string → **Transaction pooler** (port 6543) |
| `SUPABASE_URL` | Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` secret |

It must be the **transaction pooler** string, not the direct connection — the code runs with
`prepare: false` to match it, and the direct connection on port 5432 won't survive serverless.

## 4. Create the tables and load the sample roster

```bash
npm run seed:final-shift
```

That creates the `final_shift` schema and its four tables, then loads four invented guests
(`0001`–`0004`) so the whole flow is walkable before your real roster exists. It's idempotent — run
it again any time.

```bash
npm run seed:final-shift -- --check    # print what's in there, change nothing
```

## 5. Check the API

With `npm run dev` running in another terminal:

```bash
npm run test:api:final-shift
```

Plain node against the live server. It checks that every clock-in rejection is byte-identical, that
the timing floor holds, that the wall payload carries no code, no private field, and no count, and
that a partial draft save leaves the other answers alone.

**It writes to guest 0001's draft**, so run it against the sample roster, not after your crew has
started replying. `-- --rate-limit` runs the limiter suite, which is left out of the default run
because it deliberately locks clock-ins from your IP for ten minutes.

The timing suite also **deletes the clock-in limiter rows** as it goes — it needs forty clock-ins for
a usable median and the window allows eight, so without that it skipped itself on every run. One more
reason not to point this script at production.

## 6. Vercel

Set all six variables for **Production and Preview**. Preview matters: the iOS camera, HEIC,
`<dialog>`, and the safe-area insets only behave truthfully over real HTTPS in real Safari, so the
phone testing happens on a preview URL. Vercel previews are noindexed by default.

## 7. When the real roster arrives

Copy `roster.sample.json` to `roster.local.json`, replace the contents, and re-run the seed. That
file is gitignored and must stay that way — it holds real Ape Coffee clock-in codes and personal
messages to named people, and git history is recoverable after deletion.

**Do not change `FINAL_SHIFT_CODE_PEPPER` after seeding real codes.** Every stored hash is derived
from it; a new pepper locks the whole crew out until the seed runs again.

To remove someone, set `"isActive": false` — never delete the row. The submission hangs off the
guest by foreign key with `ON DELETE CASCADE`, so deleting a guest destroys their photo and their
words along with them.

## Your screen

`/final-shift/admin`, behind `FINAL_SHIFT_ADMIN_PASSPHRASE`. Read-only, and it opens with the one
thing you actually have to decide: which day works, ranked, with names. Below that, who still needs
chasing, everyone's answers, the food notes, and every photo.

Each photo is labelled with whether that guest agreed to the wall. **A photo marked private stays
private** — not printed, not projected, not posted. It is on your screen because you need to know it
arrived, not because it is yours to use.

Edits happen in Supabase Studio, not here. There are no write routes behind that passphrase, which
is the point: one password should not be able to rewrite the roster.

## Editing later, without a deploy

Everything guest-facing is read at request time, so these are live on the next page load straight
from Supabase Studio:

`first_name` · `crew_role` · `private_note` · `is_active` · `date_options` · `dietary_chips` ·
`wall_enabled` · `edits_locked`

Only `src/lib/final-shift/copy.ts` needs a deploy, which is right — that's design, not data.

## Taking it down afterwards

Three steps, in this order:

1. **Save anything you want to keep first.** The photos and the memories are the point of the whole
   thing, and step 2 destroys them. Download them from the admin screen or the Storage browser —
   remembering that a photo marked private stays private.
2. `DROP SCHEMA final_shift CASCADE;` in the SQL editor. One statement, everything.
3. Storage → `final-shift-photos` → empty it, then delete the bucket.

Then delete `src/app/final-shift/`, `src/components/final-shift/`, `src/lib/final-shift/`,
`content/final-shift/`, both scripts, the `/final-shift` block in `next.config.ts`, the six env vars
in Vercel, and `postgres` from `package.json`. Nothing else in the site imports any of it.
