# DESIGN.md — Shop app

A design and voice brief for work that should look and read like Shop, Shopify's shopping app for buyers. Use it when you build screens, mockups or copy for the take-home.

Pica, the shopping companion, has its own brief built on this one: `docs/PICA-DESIGN.md`. Where the two differ, that brief wins for Pica.

## How far to trust each part

Shop publishes little. This brief mixes three kinds of source, and each rule carries a tag.

| Tag | Meaning |
|---|---|
| **[official]** | Stated in Shopify's own docs (Shop Pay design guidelines, Shop Minis docs, Shopify voice and tone). |
| **[observed]** | Measured by third parties from the live shop.app site. Good for values, not a rule Shopify wrote. |
| **[inferred]** | My reading, where no source speaks. Change these freely. |

Two gaps to know about:

- I could not open `shop.app/brand-assets`. The site refused every request. What I cite from it (Shop purple, GT Standard, the logo rules) comes from a search summary of that page. Check it by hand before you quote it.
- Shop has no public voice guide. The voice section adapts Shopify's voice principles, which Shopify wrote for merchants, to buyers.

## 1. The idea

The products are the color. The interface stays white, grey and black so that merchant photos carry the page. Purple marks Shop itself and nothing else. Corners are soft, type is tight and plain, and each screen asks for one thing.

Shop began as a package tracker and a pay button. Its 2021 rebrand set out to make it a place to shop, with people and products in front and the brand behind them. Design toward that: a shopping app first, a utility second.

## 2. Color

### Core

| Token | Hex | Use | Source |
|---|---|---|---|
| `shop-purple` | `#5433EB` | Logo, Shop Pay button, the one main action on a screen, focus ring | [official] |
| `shop-purple-pressed` | `#4524DB` | Pressed or hover state of purple | [observed] |
| `ink` | `#000000` | Main text, icons | [observed] |
| `ink-muted` | `#787574` | Secondary text, idle icons | [observed] |
| `canvas` | `#F2F4F5` | Page background | [observed] |
| `surface` | `#FFFFFF` | Cards, inputs, sheets, pills | [observed] |
| `hairline` | `#EBEBEB` | Borders on inputs and pills | [observed] |
| `disabled` | `#CCCCCC` | Placeholders, disabled controls | [observed] |
| `ink-inverse` | `#121212` | Dark bands, dark surfaces | [observed] |

### Tints and status

| Token | Hex | Use | Source |
|---|---|---|---|
| `purple-soft` | `#DBD1FF` | Selected state, small highlights | [observed] |
| `purple-tint` | `#EEEAFF` | Faint purple background behind a small element | [observed] |
| `success` | `#008552` | Delivered, paid, confirmed | [observed] |
| `critical` | `#D92A0F` | Errors, failed payment | [observed] |
| `caution-bg` | `#FFF9E2` | Delay or warning banner background | [observed] |
| `star` | `#E3BE2B` | Rating stars | [observed] |

### Rules

- Use one purple element per screen. If two things are purple, one is wrong. [inferred, from observed use]
- Keep containers white or grey. Do not color cards, headers or sections. [observed]
- Do not add a second bright accent. [observed]
- The logo may be purple, white or black only. [official, via search summary]
- A Shop Pay button must be `#5433EB`. On a low-contrast background it takes a 1px border of `rgba(255,255,255,0.5)`. [official]
- Do not use color alone to carry meaning. Pair status color with a word or icon. [official]
- No gradients. [observed]

## 3. Type

**Typeface:** GT Standard. [official, via search summary] It is a paid font. Fall back to `Inter, system-ui, -apple-system, sans-serif`.

The 2021 rebrand used Good Sans. The live site now uses GT Standard, so use that.

| Role | Size / line | Tracking | Grade | Use |
|---|---|---|---|---|
| `display` | 20 / 22 | -1px | Semibold | Section and screen headings |
| `body-lg` | 16 / 22 | -0.5px | Regular | Body text, buttons, inputs |
| `body` | 14 / 18 | -0.2px | Regular | Secondary body, list rows |
| `title-sm` | 14 / 18 | -0.2px | Semibold | Card titles, merchant names |
| `caption` | 12 / 16 | -0.2px | Medium | Metadata, ratings, labels |
| `micro` | 11 / 15 | -0.2px | Medium | Dense tile labels only |

All values [observed] from the web. The web scale is small. On a phone screen I would set body at 16 and let headings reach 24 to 28. [inferred]

Rules:

- Build rank with size and tight tracking, not weight. Stop at Semibold. No Bold. [observed]
- Use sentence case everywhere: "Track your order", not "Track Your Order". [official, Shopify content rules]
- Keep main body text at 12px or more. [observed]
- Do not hardcode sizes in a Shop Mini. Use the SDK's text variants so type scales with the user's settings. [official]

## 4. Space, shape, depth

**Spacing scale:** 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64. [observed]

- Gap between elements: 12
- Screen side margin: 16 [inferred for mobile]
- Gap between sections: 32 on mobile, 64 on web [web value observed, mobile inferred]

**Radius** [observed]

| Element | Radius |
|---|---|
| Buttons, inputs, search, chips | Full pill (`9999px`) |
| Cards | 28 |
| Image inside a card, merchant tile | 20 |
| Small thumbnail | 12 |
| Avatar, icon button | Circle |

No sharp corners on cards, buttons or inputs.

**Depth** [observed]

- Lift comes from white on grey first, shadow second. Do not border a raised card.
- Soft shadow for pills: `0 2px 8px rgba(0,0,0,0.06)`
- Card shadow: `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)`
- Floating control: `0 4px 24px rgba(0,0,0,0.12)`

## 5. Components

| Component | Spec | Source |
|---|---|---|
| Primary button | Purple fill, white `body-lg` label, pill, 48 high on mobile (44 on web). One per screen. | [observed], height on mobile [inferred] |
| Secondary button | `canvas` fill, `ink` label, pill, 40 to 44 high | [observed] |
| Shop Pay button | Purple. Logo only, or "Buy with Shop". You may change width, height and radius. You may not change color, font, or the logo's size, color or position. | [official] |
| Text input | White, pill, 48 high, `hairline` border that turns purple on focus | [observed] |
| Search bar | White, pill, 56 high, round purple submit button | [observed] |
| Chip | White or `canvas`, pill, 32 high, 16px icon, `body` label | [observed] |
| Product card | White, radius 28, no padding around a 1:1 image with radius 20, then merchant name in `title-sm` and rating in `caption` | [observed] |
| Merchant avatar | Circle, 48, 1px `hairline` ring | [observed] |
| Carousel | Horizontal rail with an arrow, no page dots | [observed] |
| Bottom sheet, modal | Use for short tasks. Follow the platform's own pattern. | [official] |

**Shop Pay button placement** [official]: use "Buy with Shop" where the button starts checkout for one item, such as a product page. Use the logo-only button in the cart and at guest checkout, where Shop is one of several ways to pay.

**Icons:** line icons, black, one weight. Shop Minis use [Lucide](https://lucide.dev). Use icons, never emoji, in the interface. [official]

**Photos:** people and products in real settings, close crops, 1:1 for product tiles. No stock illustration, no 3D, no decoration. [observed, and from the rebrand case study]

**Stickers:** the rebrand added price-tag shapes that sit over a photo to carry a second fact, such as a discount. Use them rarely and never over the product itself. [from the rebrand case study]

## 6. Screen principles

From the Shop Minis design docs. [official]

1. **One purpose.** Each flow has one goal. Each screen has one main action.
2. **Fast start.** Show content within 3 seconds. Pre-fill what you can. Show progress in any flow with steps.
3. **Useful, then fun.** Feedback and play are welcome when they do not get in the way.
4. **Personal and shareable.** Let people save, return and share.
5. **Easy to come back to.** Make it plain how to save and pick up again.
6. **Accessible.** Large tap targets (44pt or more), enough contrast, alt text on images, screen reader support.
7. **Standard patterns.** Use the platform's navigation, sheets and gestures. Do not invent new ones.
8. **Stay the same.** Once people learn a flow, do not change it under them.
9. **Respect the safe area.** Keep navigation and key content inside it.

Hard limits Shop sets for Minis, useful as a guide to what Shop will not do [official]: no ads, no dark patterns, no pressure to grant permissions, no links out of the app, no fees charged to buyers, no changed product names or prices, no product shown in a bad light.

## 7. Voice

### Who is speaking

Shop talks to a buyer who is browsing, paying, or waiting for a parcel. It sounds like a friend who shops well: brief, warm, sure of the facts. The merchant is the star of the page, so Shop keeps its own words few. [inferred]

### Four principles

Shopify's own four, written for merchants [official], with a buyer reading of each [inferred].

| Principle | For a buyer, this means |
|---|---|
| Be real, but not too tough or overly familiar | Plain words. Own mistakes. No slang, no forced cheer. |
| Be proactive, but not needy or pushy | Tell people about a delay before they ask. Never nag them to buy. |
| Be dynamic, but not scattered or impulsive | Use verbs that show movement: "Out for delivery". Do not overstate. |
| Guide, but don't handhold or prescribe | Say why a step helps. Let the buyer choose. |

### Tone by moment

| Moment | Tone | Write | Avoid |
|---|---|---|---|
| Browsing | Quiet. Let products speak. | "New from shops you follow" | "You'll LOVE these picks!" |
| Checkout | Short and certain. Money is at stake. | "Pay now" | "Complete your amazing purchase" |
| Waiting on an order | Exact. Give a date, not a mood. | "Arriving Thursday" | "Your package is on its way soon!" |
| Routine success | Confirm and move on. | "Order placed" | "You successfully placed your order!" |
| Small error | What happened, then the fix. | "That card was declined. Try another card." | "Payment failed: invalid request" |
| Serious problem | Direct. State the effect. Say sorry if Shop is at fault. Give the next step. | "Your order is delayed. The new delivery date is May 4. You don't need to do anything." | "Don't worry, it's just a short delay!" |
| Asking for something | Say what the buyer gets. | "Turn on notifications to know when your order ships." | "Don't miss out! Enable notifications now." |
| Real milestone | Rare. Warm and brief. | "Your first order is on its way." | "Congrats! We did it!" |

Three strings are Shop's own [official]: "Buy with Shop", "Pay now", "Your order's being processed." The rest are my examples in the same manner. [inferred]

### Rules

- Sentence case. No full stop on buttons, labels or headings.
- Buttons start with a verb and name the thing: "Track order", "Follow shop". The same action keeps the same words everywhere.
- Use contractions: "you'll", "it's", "order's".
- Say "you" and "your". Use "we" only when Shop itself did something.
- Give facts over feelings: a date, a price, a count.
- Do not promise results. Do not use "successfully", "simply", "just", "easy", or "oops".
- Do not show error codes or system terms such as "invalid" or "forbidden".
- No filler text and no trailing dots ("Add a note…").
- One exclamation mark per screen at most, and only at a real milestone.
- No emoji in interface copy.
- Do not call a routine step a success, and do not take credit for what the buyer or merchant did.

### Names

| Write | Not | Note |
|---|---|---|
| Shop | SHOP, the Shop App, Shopify Shop | The app and the brand. "Shop app" is fine where "Shop" alone could be misread. |
| Shop Pay | ShopPay, Shop pay, Shopify Pay | The checkout. "Shopify Pay" is the old name. |
| Shop Pay Installments | Shop Pay installments | The pay-over-time product. |
| Shop Cash | Shop cash | The rewards balance. |
| Shop Minis | Shop minis | Small apps inside Shop. A Mini's own name may not contain "Shop" or "Mini". |
| shop (lower case) | — | A merchant's store on Shop: "shops you follow". |

Call the user a "buyer" in documents. In the interface, say "you". [inferred, from Shopify's usage]

## 8. Quick check before you ship a screen

- Is there one main action, and is it the only purple thing?
- Are all cards white on grey, with corners of 20 or more?
- Is every control a pill?
- Does the product photo take more room than the interface around it?
- Is every string in sentence case, with a verb on each button?
- Does each status give a fact (date, amount, count)?
- Does every error say what happened and what to do next?
- Are tap targets 44pt or more, and does text pass contrast on its background?
- Did you leave the Shop Pay button's color, font and logo alone?

## Sources

Official:

- [Shop Pay design guidelines](https://shopify.dev/docs/api/commerce-components/pay/design-guidelines) — button color, variants, placement
- [Shop Minis design](https://shopify.dev/docs/api/shop-minis/design) — screen principles, safe area, icons
- [Shop Minis guidelines](https://shopify.dev/docs/api/shop-minis/guidelines) — hard limits, the 3-second rule
- [Shopify voice and tone](https://shopify.dev/docs/apps/design/content/voice-and-tone) — the four voice principles and tone by situation
- [Shop brand assets](https://shop.app/brand-assets) — not read directly; cited from a search summary
- [Shopify trademarks](https://www.shopify.com/legal/trademarks) — product names

Third party:

- [PORTO ROCHA, Shop case study](https://portorocha.com/shop) — the 2021 rebrand: strategy, photos, stickers
- [Refero, Shop design system](https://styles.refero.design/style/4fa67bd1-f01d-454a-b522-4a0359ff9815) — tokens measured from shop.app
- [shadcn.io, Shop DESIGN.md](https://www.shadcn.io/design/shopify-shop) — tokens measured from shop.app
