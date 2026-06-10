# CLAUDE.md — Andrew Yang Personal Site

Personal portfolio/blog with manifestos and theses. Next.js 16 App Router, Tailwind v4, filesystem-based content. No database, no API routes.

---

## Commands

```bash
npm install
npm run dev    # localhost:3000
npm run build
npm run lint
```

No test script.

---

## Toolchain

- **npm** — no pnpm or yarn
- **Next.js 16** App Router (`src/app/`)
- **Tailwind v4** — CSS-first config in `globals.css` (`@theme inline`), no `tailwind.config.*`
- **TypeScript** strict, path alias `@/*` → `src/*`
- **Zero runtime dependencies** beyond Next/React — no markdown libraries, no CMS

---

## Content Model

All content is filesystem-based, read with `fs.readFileSync` (server-only).

| Type | Source | Format |
|---|---|---|
| Manifestos | `content/manifestos/*.md` | Markdown with YAML frontmatter |
| Theses | `content/theses.json` | JSON array |

- Manifestos link to theses via `thesis` frontmatter field → thesis `slug`
- Manifesto detail pages are statically generated (`generateStaticParams`)
- **Adding/editing content requires a redeploy**

---

## Key Patterns

- **Custom markdown renderer** (`src/lib/markdown.ts`) — hand-rolled regex, no remark/rehype/marked. Supports headings, bold, italic, links, images, code blocks, blockquotes, lists. No tables or nested lists.
- **Custom frontmatter parser** (`src/lib/manifestos.ts`) — regex-based, not `gray-matter`. Revision history uses flat keys (`revision_1_date`, `revision_1_note`, etc.)
- Fonts: Inter (sans) + Fraunces (serif headings) via `next/font/google`
- Design tokens as CSS custom properties, mapped to Tailwind via `@theme inline`
- Manifesto body rendered via `dangerouslySetInnerHTML`
- Deployed on Vercel (no `vercel.json`)

---

## Gotchas

- **`.env` contains a stale `POSTGRES_URL` with real Supabase credentials** — leftover from when this was a Relora waitlist site. The codebase no longer uses it. Should be removed or moved to `.env.local`.
- **README and PROGRESS.md are stale** — they describe the old Relora waitlist site, not the current personal portfolio
- `next/font/google` params use `Promise<{ slug: string }>` async pattern (Next.js 15+ requirement)
