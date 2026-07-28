# Final Shift — one-time backend setup

Everything below needs an Andrew-only login, which is why it isn't scripted. Fifteen minutes, once.
The secrets that don't need an account are already generated and sitting in `.env.local`.

## 1. Make the Supabase project

New project, any region close to you, and **write the database password down** — the connection
string needs it and Supabase will not show it again.

Free tier is fine on volume: ten photos is about 3 MB against a 1 GB allowance. The catch is
different. **A free project pauses after 7 days idle**, and that is a likely shape here — invite
goes out, a quiet week, then a reminder text and a burst of RSVPs that hit a paused database. Either
keep it on a paid plan for the few weeks this runs, or open the dashboard once before each reminder
you send.

## 2. Make the photo bucket

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

That creates the `fs_*` tables and loads four invented guests (`0001`–`0004`) so the whole flow is
walkable before your real roster exists. It's idempotent — run it again any time.

```bash
npm run seed:final-shift -- --check    # print what's in there, change nothing
```

## 5. Vercel

Set all six variables for **Production and Preview**. Preview matters: the iOS camera, HEIC,
`<dialog>`, and the safe-area insets only behave truthfully over real HTTPS in real Safari, so the
phone testing happens on a preview URL. Vercel previews are noindexed by default.

## 6. When the real roster arrives

Copy `roster.sample.json` to `roster.local.json`, replace the contents, and re-run the seed. That
file is gitignored and must stay that way — it holds real Ape Coffee clock-in codes and personal
messages to named people, and git history is recoverable after deletion.

**Do not change `FINAL_SHIFT_CODE_PEPPER` after seeding real codes.** Every stored hash is derived
from it; a new pepper locks the whole crew out until the seed runs again.

To remove someone, set `"isActive": false` — never delete the row. The submission hangs off the
guest by foreign key with `ON DELETE CASCADE`, so deleting a guest destroys their photo and their
words along with them.

## Editing later, without a deploy

Everything guest-facing is read at request time, so these are live on the next page load straight
from Supabase Studio:

`first_name` · `crew_role` · `private_note` · `is_active` · `date_options` · `dietary_chips` ·
`wall_enabled` · `edits_locked`

Only `src/lib/final-shift/copy.ts` needs a deploy, which is right — that's design, not data.
