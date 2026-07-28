# CLAUDE.md — Andrew Yang Personal Site

Personal portfolio/blog with memos and theses. Next.js 16 App Router, Tailwind v4, filesystem-based content.

The site is static except for one feature: **Final Shift** (`/final-shift`), the RSVP for Andrew's
leaving party at Ape Coffee. It is the only part of the codebase with a database, API routes, client
components, or secrets. Everything about it is namespaced — `final-shift` in paths, `fs_` in SQL,
`fs-` in CSS — so it stays a thing you can delete rather than something braided into the site.

---

## Commands

```bash
npm install
npm run dev    # localhost:3000
npm run build
npm run lint

npm run seed:final-shift      # creates the fs_* schema and upserts the roster. Idempotent.
npm run test:api:final-shift  # hits a running dev server; see the flags below
```

No test framework, and don't add one. `scripts/test-final-shift-api.mjs` is plain node and `fetch`.

Two warnings on the test script, both in its header as well: it **writes to the database** (it edits
guest 0001's draft), and `--rate-limit` **locks clock-ins from the runner's IP for ten minutes**. It
is excluded from the default run for that reason. Never point either script at production while
guests are using it.

---

## Toolchain

- **npm** — no pnpm or yarn
- **Next.js 16** App Router (`src/app/`)
- **Tailwind v4** — CSS-first config in `globals.css` (`@theme inline`), no `tailwind.config.*`
- **TypeScript** strict, path alias `@/*` → `src/*`
- **Zero runtime dependencies** beyond Next/React — no markdown libraries, no CMS.
  **One exception: `postgres`**, ~40 KB, no native bindings, added for Final Shift. It is the only
  client that cleanly supports the `prepare: false` mode Supabase's transaction pooler requires.
  Deliberately *not* added alongside it: `@supabase/supabase-js` (Storage is six REST calls in
  `lib/final-shift/storage.ts`), `zod` (payloads are flat; the real validation is membership against
  server-known sets), and any animation library (every motion is a CSS `@keyframes`).

---

## Content Model

All content is filesystem-based, read with `fs.readFileSync` (server-only).

| Type | Source | Format |
|---|---|---|
| Memos | `content/memos/*.md` | Markdown with YAML frontmatter |
| Theses | `content/theses.json` | JSON array |

- Memos link to theses via `thesis` frontmatter field → thesis `slug`
- Memo detail pages are statically generated (`generateStaticParams`)
- **Adding/editing content requires a redeploy**

Final Shift is the exception: its content is rows, not files. Every guest-facing route is
`force-dynamic` and reads at request time, so `first_name`, `crew_role`, `private_note`, `is_active`,
`date_options`, and `dietary_chips` can be edited straight in Supabase Studio and are live on the
next load. Only `src/lib/final-shift/copy.ts` needs a deploy — that's design, not data.

---

## Final Shift

`/final-shift` — a seven-stage RSVP for under ten guests. Full plan and rationale in
`~/.claude/plans/new-project-andrew-is-groovy-pebble.md`; setup steps in
`content/final-shift/SETUP.md`.

**It is unlisted, and that is a requirement, not a default.** Never add it to `SiteNav.tsx`,
`sitemap.ts`, or `robots.txt`. It is reachable only by the link Andrew sends. The `Disallow` line
some tools want to add to `robots.txt` would be worse than nothing: `robots.txt` is public, so it
would advertise the path. `noindex` metadata plus the `X-Robots-Tag` header in `next.config.ts` are
the right instruments and they say nothing out loud.

**The four-digit codes are the guests' real Ape Coffee clock-in credentials.** They are stored only
as `base64url(HMAC-SHA256(FINAL_SHIFT_CODE_PEPPER, code))`, so a database dump, a stray log, or a
screen-share of Supabase Studio never exposes a coworker's workplace credential. Consequences worth
knowing before touching anything:

- **`FINAL_SHIFT_CODE_PEPPER` must never change once the real roster is seeded.** Every stored hash
  derives from it; rotating it locks all ten guests out at once.
- The code is returned exactly once, in the clock-in response. A resumed session gets `code: ""` and
  the UI masks it to `••••`.
- Every failure from `POST /api/final-shift/session` — bad format, unknown code, inactive guest,
  honeypot — returns a **byte-identical** body, padded to a `max(elapsed, 300ms)` floor. That pair
  closes the enumeration oracle on a four-digit space. `npm run test:api:final-shift -- --auth
  --timing` asserts both; don't "tidy" either one away.

**The roster never goes in git.** `content/final-shift/roster.local.json` holds the real codes and
Andrew's private notes and is gitignored (`content/final-shift/*.local.json`). Only
`roster.sample.json` is committed, and it is entirely fictional. Committing the real one would put
personal messages to named coworkers in git history permanently.

Tables are `fs_guests`, `fs_submissions`, `fs_event_config`, and `api_rate_limits`. **The DDL lives
in `scripts/seed-final-shift.mjs`**, deliberately unlike `relora-website`'s inline
`CREATE TABLE IF NOT EXISTS` — we always seed before deploying, so the routes skip the round trips.

Env vars, all server-only, none `NEXT_PUBLIC_`: `POSTGRES_URL`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `FINAL_SHIFT_SESSION_SECRET`, `FINAL_SHIFT_CODE_PEPPER`,
`FINAL_SHIFT_ADMIN_PASSPHRASE`. `src/lib/final-shift/env.ts` throws on browser import and every
secret-touching module imports it — that throw is what keeps the service-role key out of a bundle.
There must never be a `NEXT_PUBLIC_` variable in this feature.

Other invariants:

- **Design tokens are scoped to `.fs-root`** in `src/app/final-shift/final-shift.css`. Do not put
  `fs-` variables in `globals.css`'s `@theme inline` — that block is global and would emit them on
  every page, coupling a one-off party feature to the permanent design system.
- **The wall query uses an explicit column list and returns no count.** At this group size a count
  identifies the people who opted out by elimination. `src/lib/final-shift/wall.ts` is the single
  place the wall payload is built; `--privacy` asserts the shape.
- The photo bucket is **private**. Photos are served through 900-second signed URLs minted
  server-side after the cookie check, never from a public bucket.

---

## Key Patterns

- **Custom markdown renderer** (`src/lib/markdown.ts`) — hand-rolled regex, no remark/rehype/marked. Supports headings, bold, italic, links, images, code blocks, blockquotes, lists. No tables or nested lists.
- **Custom frontmatter parser** (`src/lib/memos.ts`) — regex-based, not `gray-matter`. Revision history uses flat keys (`revision_1_date`, `revision_1_note`, etc.)
- Fonts: Inter (sans) + Fraunces (serif headings) via `next/font/google`
- Design tokens as CSS custom properties, mapped to Tailwind via `@theme inline`
- Memo body rendered via `dangerouslySetInnerHTML`
- Deployed on Vercel (no `vercel.json`)

---

## Gotchas

- **This file used to warn about a `.env` holding a live Relora `POSTGRES_URL`. There is no such
  file.** Checked in July 2026: no `.env` on disk and none in git history — `.gitignore` has always
  covered `.env*`. Nothing was ever exposed and there is nothing to rotate. Secrets now live in
  `.env.local` and in Vercel (Production **and** Preview — real-phone testing happens on previews).
- **README and PROGRESS.md are stale** — they describe the old Relora waitlist site, not the current personal portfolio
- `next/font/google` params use `Promise<{ slug: string }>` async pattern (Next.js 15+ requirement)
- **Supabase's free tier pauses a project after 7 days idle.** Likelier here than it sounds: under
  ten guests can easily go a quiet week between the invite and the reminder. Warm it before each
  reminder text, or keep it paid for the duration.
- Global `:focus-visible` in `globals.css` uses a near-white tint that is invisible on the Final
  Shift espresso background. `.fs-root` overrides it. Don't remove the override.
- Route handlers stay on the **Node runtime** — `postgres` needs TCP, so no `runtime = "edge"`.
