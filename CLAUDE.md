# CLAUDE.md — Andrew Yang Personal Site

Personal portfolio/blog with memos. Next.js 16 App Router, Tailwind v4, filesystem-based content.

The site is static. It has no database, no API routes, no client components, and no secrets.

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
- **Zero runtime dependencies** beyond Next/React — no markdown libraries, no CMS.

---

## Content Model

All content is filesystem-based, read with `fs.readFileSync` (server-only).

| Type | Source | Format |
|---|---|---|
| Memos | `content/memos/*.md` | Markdown with YAML frontmatter |

- Memo detail pages are statically generated (`generateStaticParams`)
- **Adding/editing content requires a redeploy**

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
