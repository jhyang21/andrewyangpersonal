# Pica

A shopping companion for bags, backpacks and luggage. Pica, a magpie, starts from the buyer's goal ("two weeks in Japan without checking a bag"), works back to what it takes, and helps them work out what is worth buying before it shows products. Built for a Shopify APM take-home from `docs/PRD.md`; `DESIGN.md` holds the design and voice brief.

## Run it

Needs Node 22 or later and pnpm.

```bash
pnpm install
pnpm dev
```

The app reads its settings from environment variables:

- `OPENAI_API_KEY` is needed for Pica's chat (model `gpt-6-luna`). If it is already set as a system or user variable on your machine, there is nothing to do: the server picks it up. A system variable wins over an env file. With no such variable, copy `.env.example` to `.env.local` and fill it in.
- No key at all? Home asks on first run. Paste a key there and the dev server keeps it in memory only (never on disk; paste it again after a restart), or pick the demo and press Next to step through a scripted decision from goal to Compare with no AI calls. The setup route answers only on localhost and is off in production builds.
- Shopify Catalog credentials are optional. Without them, search runs keyless and checkout uses the merchant's direct checkout link.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

The live Shopify tests are skipped unless `SHOPIFY_LIVE=1` is set.

## Where things are

| Path | What |
|---|---|
| `src/app/(site)` | Pages: home, browse, workspace (`/d/[id]`), decide, saved |
| `src/app/api` | Server routes: chat, catalog, checkout, events, setup (the local key) |
| `src/features` | The screens, one folder each: home, workspace (chat, Options, Compare), decide, decision (Done), saved, browse, shell (header), and demo (the scripted demo) |
| `src/features/parts` | Parts more than one screen shares (path, menus, sheets, notices); preview at `/kit/parts` |
| `src/features/shared` | Helpers the screens share: fetch, errors, formats, the journey facts |
| `src/components/kit` | The component kit; preview at `/kit` |
| `src/components/mascot` | Pica the magpie (eight poses), the avatar and the thinking row |
| `src/app/kit` | Review pages: the kit, the parts (`/kit/parts`), the stages (`/kit/stages`) and a seed decision (`/kit/seed`) |
| `src/lib/pica` | Pica's prompt, tools and the guards on what it may say |
| `src/lib/shopify` | Catalog and checkout clients, limits, caching |
| `src/lib/session` | The decision session, kept in the browser's local storage |
| `src/lib/analytics` | The PRD's events, written to the server log |

## Rules the code enforces

- Pica can only recommend products fetched from the catalog in this session.
- Prices, ratings, stock and images come from the catalog record, never from Pica's text.
- Each claim is labeled: "Merchant says", "From the listing, summarized by Shopify", "Pica's read" or "Not verified".
- Checkout starts only on the buyer's click. The app never completes a purchase.

## Known limits

- No accounts and no database: decisions live in one browser.
- The rate limits trust the first forwarded address and assume no trusted proxy. Fix this before a real pilot.
- The wording filter on Pica's replies cannot catch every sales phrase.
- Checkout through Shopify's token tier is built but was not available to test; the direct link path is the one verified.
- The app cannot see orders. The post-purchase check-in works from the buyer's own report.
- A shortlist can hold fewer than three products when a narrow need leaves few matches. Pica says so.
- The decide page remembers the options taken to checkout only until the buyer answers "Did you buy it?". After that a reload starts on the default option.
- A buyer whose clock is wrong gets the price and stock check before checkout about every 5 minutes, not every 10.
- If the chosen variant vanishes while a checkout request is in flight, the old variant's cost review can still appear. The checkout route refuses a missing or sold-out variant.
