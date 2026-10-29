# CLAUDE.md — Andrew Yang Personal Site

Personal portfolio/blog with memos. Next.js 16 App Router, Tailwind v4, filesystem-based content.

The site is static. It has no database, no API routes and no secrets. The only client components are the Shape Lab (`src/components/shape-lab/`), the projects chart and the cup-notes demo (`src/components/projects/cup-notes/`).

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
- **Runtime dependencies** beyond Next/React: `katex`, for math in memos, and `motion`, `recharts` and `lucide-react`, imported only by the cup-notes demo. No markdown libraries, no CMS.

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
