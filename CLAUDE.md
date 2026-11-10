# CLAUDE.md — Andrew Yang Personal Site

Personal portfolio/blog with memos. Next.js 16 App Router, Tailwind v4, filesystem-based content.

The site is static. It has no database, no API routes and no secrets. The only client components are the Shape Lab (`src/components/shape-lab/`), the projects chart, the cup-notes demo (`src/components/projects/cup-notes/`) and the Apparatus Signals map and lead table (`src/apparatus-signals/ui/`).

---

## Commands

```bash
npm install
npm run dev    # localhost:3000
npm run build
npm run lint
```

---

## Toolchain

- **npm** — no pnpm or yarn
- **Next.js 16** App Router (`src/app/`)
- **Tailwind v4** — CSS-first config in `globals.css` (`@theme inline`), no `tailwind.config.*`
- **TypeScript** strict, path alias `@/*` → `src/*`
- **Runtime dependencies** beyond Next/React: `katex`, for math in memos; `@vercel/analytics`, whose `<Analytics />` in the root layout counts page views; and `motion`, `recharts` and `lucide-react`, imported only by the cup-notes demo. No markdown libraries, no CMS.

---

## Content Model

All content is filesystem-based, read with `fs.readFileSync` (server-only).

| Type | Source | Format |
|---|---|---|
| Memos | `content/memos/*.md` | Markdown with YAML frontmatter |

- Memo detail pages are statically generated (`generateStaticParams`)
- **Adding/editing content requires a redeploy**

### Cup-notes dataset

- `/projects/cup-notes` replays a precomputed simulation. `simulation/` is the Python generator; `simulation/SPEC.md` is the contract, mirrored in `src/lib/cup-notes/types.ts`.
- `content/cup-notes/index.json` is read at build time; the 24 `public/cup-notes/scenarios/<key>.json` files are fetched by the demo on demand.
- `npm run build` runs `npm run check:dataset` first, which fails unless the index exists, came from the OpenAI batch run (not the fixture) and every scenario has a file. Use `npx next build` to build against fixture data locally.

### Apparatus Signals microsite

- `/apparatus-signals` is a self-contained microsite: routes in `src/app/apparatus-signals/`, code in `src/apparatus-signals/` (`lib/`, `ui/`, `styles.css`), data in `content/apparatus-signals/`. Every internal link starts with `BASE` from `src/apparatus-signals/lib/site.ts`.
- Its data comes from the pipeline in `~/Documents/projects/apparatus-signals/`. To refresh it, rerun `python export_site.py` in that repo's `pipeline/` (it writes straight into `content/apparatus-signals/`), then build and commit here. The build fails if the data carries a phone, an outreach field or a forbidden word (`lib/data.ts`).
- It has its own tokens, font (Geist) and nav on purpose; it does not use `SiteNav`. Its entry in `content/projects.json` carries `href: "/apparatus-signals"`, so the Projects list links to the microsite instead of a `/projects/<slug>` page, and the sitemap skips it there (its own section lists every page). Its tokens are scoped to the `.apparatus-signals` wrapper and prefixed `--as-*`; the only trace in `globals.css` is the `--color-as-*` lines in `@theme inline`, which give it utilities like `text-as-muted`.

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

- **There is no `.env` and no secrets.** `.env.local` holds only Vercel's OIDC token from `vercel env pull`. `.gitignore` covers `.env*`.
- **README and PROGRESS.md are stale** — they describe the old Relora waitlist site, not the current personal portfolio
- Dynamic route `params` are `Promise<{ slug: string }>` — `await` them (Next.js 15+)
