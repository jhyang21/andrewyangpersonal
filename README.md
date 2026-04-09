# Andrew Yang — Personal Site

Personal website with two modes: a clean blog-style default and an optional cinematic experience for exploring evolving ideas.

## Routes

### Default mode (blog-style)

- `/` — Homepage with bio, recent manifestos, social links
- `/theses` — All theses listed with revision history
- `/manifestos` — All manifestos listed
- `/manifestos/[slug]` — Individual manifesto with linked thesis

### Cinematic mode (immersive)

- `/cinematic` — Thesis wall with floating, animated nodes
- `/cinematic/thesis/[slug]` — Scroll-driven thesis evolution experience with ghost layers, contradictions, and linked essay

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Tech stack

- **Framework:** Next.js 16 (App Router) on Vercel
- **Styling:** Tailwind CSS 4 + CSS custom properties
- **Fonts:** Fraunces (serif headlines) + Inter (body/UI)
- **Animations:** Framer Motion (transitions, scroll-driven effects)
- **Smooth scroll:** Lenis (cinematic mode only)
- **State:** Zustand (cinematic entry transitions)

## Content system

### Theses

Short beliefs stored in `content/theses.json`. Each thesis has a title, category, body, and revision history.

### Manifestos

Long-form essays stored as markdown files in `content/manifestos/` with YAML frontmatter. Each manifesto can link to a thesis via the `thesis` frontmatter field.

### Cinematic theses

Extended thesis data for cinematic mode lives in `content/cinematic-theses.json`. Each entry includes:

- `versions[]` — Versioned body text with dates and change reasons
- `state` — `stable`, `evolving`, `contradicted`, or `emerging`
- `contradictions[]` — Moments where the idea was challenged
- `relatedTheses[]` — Slugs of connected ideas
- `essaySlug` — Links to a manifesto

### Adding a new thesis + essay

1. Add the thesis to `content/theses.json` (for the default site)
2. Create a manifesto markdown file in `content/manifestos/[slug].md`
3. Add the cinematic entry to `content/cinematic-theses.json` with versioned body text
4. The cinematic thesis wall and experience pages auto-generate from the data

## Architecture

```
src/
  app/
    page.tsx                          # Default homepage
    theses/page.tsx                   # Default theses list
    manifestos/                       # Default manifesto pages
    cinematic/
      layout.tsx                      # Dark theme + Lenis + cinematic nav
      page.tsx                        # Thesis wall
      thesis/[slug]/
        page.tsx                      # Server component (data loading)
        ThesisExperience.tsx          # Client component (scroll-driven UI)
  components/
    SiteNav.tsx                       # Default site navigation
    cinematic/
      ThesisWall.tsx                  # Floating thesis node layout
      ThesisNode.tsx                  # Individual animated node
      TimelineScroller.tsx            # Scroll-to-version mapper
      VersionedText.tsx               # Sentence-level crossfade
      GhostLayer.tsx                  # Past version overlay
      ContradictionMarker.tsx         # Visual contradiction breakpoint
      CinematicEntry.tsx              # Zoom/dissolve page transition
      CrossThesisNav.tsx              # Related ideas navigation
      ScrollProgress.tsx              # Version timeline rail
      ChangeReasonReveal.tsx          # Expandable change reason
      LenisProvider.tsx               # Smooth scroll context
      ReducedMotionProvider.tsx       # prefers-reduced-motion context
      CinematicNav.tsx                # Floating dark nav
      CinematicBody.tsx               # Body class manager
  lib/
    theses.ts                         # Base thesis data loader
    manifestos.ts                     # Manifesto data loader
    markdown.ts                       # Zero-dep markdown-to-HTML
    cinematic-theses.ts               # Cinematic thesis data loader
    cinematic-store.ts                # Zustand store
    cinematic-utils.ts                # Visual mapping, sentence splitting, scroll math
  types/
    cinematic.ts                      # TypeScript types for cinematic content
content/
  theses.json                         # Base theses
  cinematic-theses.json               # Extended cinematic data
  manifestos/                         # Markdown essays
```

## Design decisions

- **Two separate route trees** — Cinematic lives under `/cinematic` so the default site has zero risk of regression. They share the same content files and data loaders.
- **Sentence-level crossfade** (not word-level diff) — More reliable and performant. Word-level morph can be added later.
- **Stable scroll segments** — Each version occupies a scroll segment. Transitions only fire at ±5% boundary zones. Content is readable 90% of the time.
- **DOM rect entry transitions** — ThesisNode captures `getBoundingClientRect()` on click and stores it in Zustand. CinematicEntry animates from that position. Falls back to center fade-in for direct URL access.
- **CSS keyframe state animations** — Glow, pulse, blur, shimmer run on GPU via CSS, not JS. Disabled via `prefers-reduced-motion`.

## Accessibility

- All cinematic animations respect `prefers-reduced-motion`
- Keyboard navigable (thesis nodes are focusable, Enter/Space to activate)
- ARIA labels on interactive elements
- Sufficient contrast in dark theme
- Touch-friendly on mobile (no hover-only interactions)
