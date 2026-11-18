# Pica design brief

The design for Pica, the shopping companion in `PRD.md`. It sits on top of `DESIGN.md`, the Shop base: Shop's colour, type, shape and voice rules hold unless this brief says otherwise. Where the two differ, this brief wins for Pica and gives the reason.

Read this before you build or change any screen. Section 11 is the check list.

## 1. The idea: weigh it up

A magpie picks things up, turns them over and keeps few of them. Pica does the same with the buyer, in the open. It starts from the buyer's goal (what they want to be true), asks what that takes, lays out a few real options, shows what each one costs you, and is content if you walk away.

One question judges every choice in this brief, and it comes from the PRD:

> Does this help the buyer understand what's worth buying, or does it only make it easier to sell them something?

Three things follow.

1. **The buyer's goal and needs are always in view.** The goal leads and the needs follow from it. They are the measure for every product, so they never hide behind a tab.
2. **Every claim shows where it came from.** The buyer said it, the merchant says it, the listing says it, Pica reads it that way, or nobody has checked.
3. **Not buying is a finished job.** "End without buying" is reachable from every screen of a decision (the header menu, the foot of Options and Compare, and Decide). On Decide, where the buyer chooses, it is the same size as the button to check out. It ends with the same care and the same pose.

## 2. What we take from Duolingo, and what we refuse

Pica borrows how Duolingo makes a hard thing feel light. It does not borrow how Duolingo brings people back.

| Take | How Pica uses it |
|---|---|
| One clear next step | Each screen has one main action. It is the only purple thing. |
| A path you can see | Four stages sit at the top of a decision. You always know where you are and what is left. |
| A character that carries state | Pica's pose tells you what is going on before you read a word. |
| Motion that answers you | Each thing you do gets a small, quick reply on screen. |
| Plain, warm words | Short sentences. No shop talk. |

| Refuse | Why |
|---|---|
| Streaks, points, levels, badges | They reward coming back, not deciding well. |
| Countdowns, "only 2 left", nudges to hurry | The PRD bans false urgency. |
| Guilt ("Pica misses you") | The PRD bans guilt. Nothing greets a returning buyer with a question about why they left. The reason chips on Done are optional, labelled so, and shown once. |
| A bigger cheer for buying than for not buying | The PRD counts both as success. One pose, `settled`, serves both. |
| Match scores and percent rings | The PRD bans unexplained match numbers. The path shows counts, never a percent. |
| Fixed steps you must finish | Stages are links. You can skip, go back or stop at any point. |

## 3. Foundations

### Colour

Shop's 15 tokens stay as they are in `src/app/globals.css`. One token is new.

| Token | Hex | Use | Why |
|---|---|---|---|
| `ink-soft` | `#666362` | Secondary text on any background but white | `ink-muted` on `canvas` is 4.1:1 and fails AA at every text size the scale has. `ink-soft` on `canvas` is 5.4:1. Measure it in the browser before it ships. |

Rules (ratios worked out by formula; AA needs 4.5:1 for text and 3:1 for the edge of a control):

- **Secondary text:** `ink-muted` on white only (4.6:1), and for idle icons. `ink-soft` on `canvas`. On `purple-soft`, `purple-tint` and `caution-bg`, all text is `ink`; neither muted colour passes there.
- **Headings are always `ink`,** never a muted colour.
- **Status colours as text sit on white only.** `critical` and `success` both fail on `canvas`. They always come with a word or an icon.
- **Purple** marks the one main action on a screen, plus the focus ring. If two things are purple, one is wrong.
- **Selected state is never the fill alone.** `purple-soft` on white is 1.4:1, so a selected chip or toggle also gains a check icon and a 2px `ink` border. The current stage is also semibold.
- **Input edges.** `hairline` on white is 1.2:1, and a white input on `canvas` is 1.1:1. Inputs and unselected chips take a 1px `ink-muted` border on any background. This overrides `DESIGN.md`.
- **Placeholders** are `ink-soft`, not `disabled` (1.6:1), and every input has a real label; a placeholder is never the only label. This overrides `DESIGN.md`.
- The mascot's wing patch is `purple-soft`. It does not count as the screen's purple thing.
- No dark mode in this round. This is a known limit.

### Type

Inter, with the scale already in `globals.css`: `display` 24/28, `heading` 20/22, `body-lg` 16/22, `body` 14/18, `caption` 12/16. Semibold is the heaviest weight. Sentence case everywhere. This is the phone scale `DESIGN.md` suggests in a note; its table lists the smaller web sizes, where `display` is 20/22. Pica uses the larger scale at every width.

- One `display` line per screen: the question or the outcome.
- Pica's chat text is `body-lg`. So is the buyer's.
- Prices are `body-lg` semibold on cards and `heading` on Decide.

### Space, shape, depth

As `DESIGN.md`: 16px side margin on phone, 12px between parts, 32px between sections; cards 28, images 20, thumbnails 12, every control a pill. White on grey gives lift first, shadow second.

Two additions:

- **Chat bubbles** use radius 20. Pica's are white. The buyer's are `purple-tint` with `ink` text, not black, so the chat reads as a talk between two parties and the product photos stay the darkest thing on screen.
- **Docked bars** (the phone's bottom bar, the summary strip, the docked thread) are white with `shadow-float` and respect the safe area.

### Motion

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 120ms | Presses, hovers, chip toggles |
| `--duration-base` | 200ms | Sheets, view changes, cards coming in |
| `--duration-slow` | 320ms | Pose changes, a need landing on the canvas |
| `--ease-out-soft` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | The default curve |
| `--ease-settle` | `cubic-bezier(0.3, 1.3, 0.5, 1)` | A slight overshoot, only for "lands" moments |

Rules:

- Motion answers an act of the buyer's or marks a change of state. Nothing moves to draw the eye.
- The three "lands" moments: a need is added to the canvas (the summary strip's count changes and the strip lifts once), a stage's count changes, an option joins the comparison.
- Nothing loops except Pica's `thinking` pose and loading shapes.
- Under reduced motion, every change is instant and Pica holds still.

## 4. Pica the magpie

`DESIGN.md` allows no illustration or decoration. Pica is the one stated exception: a single character that carries state, never a scene, never a pattern, never more than one.

Pica is drawn fresh for this design: a magpie in line and flat fill on a 48-unit grid, built to sit beside Lucide icons. Black head and back, white belly, one `purple-soft` wing patch, a long tail that gives it a clear outline. It must read at 24px; under 32px it drops to a simpler drawing with a heavier line.

Each pose means one thing. Do not use a pose for anything else.

| Pose | Means | Where |
|---|---|---|
| `idle` | Ready | Header mark, Home, chat avatar at rest |
| `listening` | You are typing; Pica attends | Home and chat, while the input has text |
| `thinking` | Pica is working | While a reply streams. Head tilt and blink; the only looping motion. |
| `found` | Options are ready | The note that a shortlist arrived; top of Options |
| `weighing` | Two or more things side by side | Top of Compare; empty Compare |
| `unsure` | A gap or a fault | Errors, empty results, "not verified" notes |
| `resting` | Paused or put down | Saved for later; an empty Saved screen |
| `settled` | A decision is made | Done, for bought and for not buying alike |

Rules:

- One Pica per screen region. Never two in view on a phone.
- Pica never points at a buy button, never looks sad, never celebrates a purchase.
- Pica is decorative to a screen reader except in `thinking`, where a polite live region says "Pica is working on it".
- Sizes: 24 inline, 32 header, 40 chat avatar, 120 on Home, Done and empty states.

## 5. The path

Four stages show across the top of the workspace, Decide and Done.

**Needs · Options · Compare · Decide**

| Stage | Shows | Links to |
|---|---|---|
| Needs | "3 needs", or "None yet" | Chat on phone with the canvas sheet open; the canvas on desktop |
| Options | "4 options", or "None yet" | Options view |
| Compare | "Comparing 3", or "Optional" | Compare view |
| Decide | The outcome ("Bought", "Not buying", "Saved"); "Chosen" while an option is chosen and the decision is open; else "Nothing chosen" | Decide if an option is chosen; Options if not. It never opens an error. |

- Every stage is a link at all times. None is locked.
- **A need** is a must-have or a nice-to-have. "3 needs" counts those. Budget, your goal, and open questions are not counted; they show under their own names.
- The current stage has a `purple-soft` pill and semibold text. The counts are the only other state. No ticks: needs stay open to change, so nothing here reads as "done".
- Compare reads "Optional" because it is. A buyer may go from Options to Decide.
- On phones the path is one row: four short labels, with the fact under the current one only.
- It is a `nav` with the label "Decision stages", and the current stage carries `aria-current="step"`.

## 6. Screens

### 6.1 Home

**Purpose:** describe, in your own words, what life looks like once you have the right bag. A goal, not a product: Pica works back from it. A buyer who names a product is asked what it's for.

- Pica at 120, `idle`, turning to `listening` once you type.
- One `display` line: "What does your life look like after you get your ideal bag?"
- The goal box: white, radius 28, `shadow-float`, with a round purple send button. This is the screen's one purple thing. Its label, read by screen readers, answers the heading: "Describe your life once you have the right bag".
- The box does not take focus on load: on a phone that would open the keyboard over the page.
- Under it, three or four example chips that fill the box when tapped. Each answers the heading with a picture of life after, not a bag: "My shoulder no longer aches after the commute", "Two weeks in Japan without checking a bag", "I go from the office to dinner with one bag". The box's placeholder follows suit: "A week away, and everything fits in one bag". A chip fills the box only while it is empty or still holds an example's words; it never replaces what the buyer typed.
- One quiet line of scope: "Pica looks across products from Shopify merchants, not every shop on the web."
- **Pick up where you left off.** If the buyer has open decisions, a card for the newest sits under the scope line: title, stage facts, "Resume". A link to Saved follows if there are more. The card comes from the browser's store, so it arrives after the first paint; it sits below the box and chips so that they never move under the buyer's finger.
- Category links to Browse sit at the foot: Bags, Backpacks, Luggage.
- **First run: a key or the demo.** Home asks the local server (`GET /api/setup`) whether it holds an OpenAI key. While it asks, a grey block holds the box's place. With no key, a card takes the place of the goal box and chips: "How do you want to start?", two options and one purple Next.
  - "Use my OpenAI key" (picked first) opens a password field. The browser neither shows nor saves it, and it empties after each send. The server checks the key with OpenAI once, then keeps it in memory only: never on disk, gone after a restart. A refused key shows under the field: "OpenAI didn't accept that key."
  - "Try the demo" opens a demo decision. Next in the workspace steps through a script; no AI calls.
  - Once a key is kept, a quiet "Change setup" line at the foot brings the card back, with "Forget my key" and "Keep my key".
  - A key can be added only on this computer (localhost), never in a production build. A hosted copy, such as the one on the personal site, still asks whether a key is held; with none, the card offers the demo alone: "This copy of Pica runs without an OpenAI key, so it can't chat. You can watch a set example of how it works." There is no "Change setup" there.
- **The demo bar** (workspace, demo decisions only): a white bar under the path, sticky on desktop. "Demo · Step 2 of 4", one line on what Next does, "Leave demo" and a purple Next. Next sends the buyer's next scripted turn; the scripted reply streams through the usual chat path, then the view moves on: goal → Pica's question → the answer fills the needs → Options → Compare. Next waits while Pica replies. The step comes from the messages, so a reload resumes. Anything the buyer types gets one line pointing back to Next. Decide, for a demo, says the demo stops before checkout, with "Back to Compare".

### 6.2 Workspace

The workspace is one decision. It has three views (Chat, Options, Compare) and one thing that never leaves: the buyer's needs.

**Phone**

From top to bottom: header, the path, the summary strip, the view, the bottom bar.

- **Summary strip.** One line, in view except as "What stays fixed on a phone" says below, built from the canvas: the goal first, then category, budget, the count of needs, and guesses waiting. "A lighter commute · Backpacks · under $200 · 3 needs · 1 to confirm". Parts with no value are left out; with nothing yet it reads "Your needs: none yet". Tap it and the canvas opens as a sheet. The strip is a button; a visually hidden `role="status"` region beside it, not inside it, announces a change.
- **Bottom bar.** Three items with icon and label: Chat, Options, Compare. Options and Compare show a count once they hold something.
- **Composer.** In Chat it is the full input. In Options and Compare a one-line input sits above the bottom bar, with the label "Ask Pica about these options".
- **What stays fixed on a phone.** The path is never fixed; it scrolls away with the page. The bottom bar hides while any input in the view has focus (CSS `:focus-within`, no script), which covers the open keyboard. Only the summary strip, the composer and the docked thread are fixed. On a phone the docked thread shows two lines at most, with an "Open chat" link that goes to the Chat view. A chat banner is the one exception: the half-screen rule does not bind while it shows. While a banner shows, the reply line hides, and the banner takes up to a third of the screen; past that it scrolls inside, and while it scrolls, and only then, it is a tab stop, so a keyboard can scroll it. The docked thread may pass half the screen to give the banner that room. While an input has focus the summary strip and the docked thread's title row hide too; the two lines, the "Open chat" link and the composer stay, and together they take 170px at most at the default text size, because an open keyboard covers the page without changing the height CSS sees. On a screen shorter than 480px the strip scrolls with the page and the docked thread shows one line at most, with the link and the composer. At 200% text the docked thread also drops to one line. After a send on a phone the composer gives up focus, so the bottom bar comes back. Content must keep at least half the screen. Measure it at rest, with no banner or field error showing, at 360x640, 320x568 and 640x400; the rule in section 9 for 320px and 200% text still binds. "Go to chat" in an empty stage follows the "Open chat" rule: the composer takes focus.
- **640 to 1023px** uses the phone layout, with content held to 720px wide and option cards two to a row.

**Desktop**

- **1024 to 1439px: two zones.** Chat column on the left (360px), the stage on the right (Options or Compare). The needs stay in the summary strip, above the stage.
- **1440px and up: three zones.** Chat column (360px), the stage, and the canvas as a rail on the right (320px).
- **When Compare is the stage,** at every desktop width, the chat column shrinks to the docked thread and the rail folds into the summary strip, so the table has the full width.
- **The page fits the screen in Chat and Options.** The chat column and the stage each scroll inside, and the composer stays at the foot of the column, so a long thread never makes the page longer. Below a 384px-tall workspace the page scrolls instead. Compare scrolls as a page, under its docked chat.
- Page margin 16px; 24px between zones.
- Lay this out with CSS breakpoints, not with a script, so the page does not jump on load.

**Chat**

- Pica's messages: avatar at 40, white bubble. The buyer's: right side, `purple-tint` bubble.
- **Question card.** Pica's question, then one line that says why it matters, then up to four answer pills, then "Skip this question". Above it, "Question 2 of up to 4", so the buyer knows this is short. Once answered, the card locks and shows the answer given, with one line: "Change this in your needs". The canvas is where an answer changes.
- **Confirm card.** When Pica guesses needs, they show in the chat as one card per update, not one per guess: up to three guesses, each with a "Pica's guess" tag and two buttons, "Confirm" and "Edit". More than three adds a "See all in your needs" link. "Edit" opens the item in the canvas. After a confirm, the row reads "You confirmed this". If the item is later changed or removed, the row reads "Changed in your needs" and its buttons go. The guess is on the canvas either way; the card is a faster road to it.
- **Notes.** Small centred lines for what Pica did: "Added 2 needs", "Looked at 12 products from Shopify merchants", "4 options ready". Each sits in a `role="status"` container with a link inside to the place it names; the role never goes on the link itself. The product count is the number of distinct products the search returned this turn, never the catalog's estimate of all matches.
- **Pica's own messages from the server** (catalog down, no results, a line it cut) show word for word as Pica's bubbles. See section 7.
- "Show me products now" is always offered once Pica has replied and no shortlist exists.
- While Pica replies: `thinking` pose with "Pica is working on it"; the input stays open for typing; the send button waits.

**Canvas (the needs)**

The same content in the phone sheet and the desktop rail.

- Heading "Your needs", with one line under it: "Your goal, and what it takes. Change anything here and Pica works from it."
- Groups in this order: Your goal, Budget, Must-haves, Nice to have, Still open.
- Every item carries a source tag: **You said** or **Pica's guess**. A guess has "Confirm" beside it. Editing a guess makes it yours.
- Each item edits in place on tap. "Add a must-have" and "Add a nice-to-have" sit at the foot of their groups.
- While Pica is replying the canvas is locked, and says so: "Pica is replying and may update this."
- Confirming a guess does not mark the options as out of date. Changing what a need says does.

**Docked thread**

When you send a message from Options or Compare, you stay there. A small panel above the composer shows your message and Pica's reply as it arrives, with any question card or error. On desktop "Open chat" expands it in place, and it never shrinks while the buyer types. On a phone it holds two lines at most. They show the start of Pica's latest reply, or the thinking row while Pica works; the buyer's own message does not show there. A reply longer than two lines is cut with an ellipsis, and this holds for Pica's own problem lines from the server too; "Open chat" beside it is the way to the rest. Any banner the chat would show (an error, "no reply came", "too many messages", "conversation full") shows in full. "Pica not set up" shows as one plain line, "Pica can't chat yet", with the composer off; the full pattern is in Chat. A question card or confirm card shows as one line of plain text that names it ("Pica asked a question", "Pica has guesses to confirm"); the card itself is in Chat. "Open chat" is the one link, and it goes to the Chat view with focus on the newest of Pica's messages, or on the thinking row while a reply is still coming. With neither, focus goes to the composer. That focus is set by script (`tabindex="-1"`), so it adds no tab stop. It shows only where the chat column is out of view: on phone in Options and Compare, and on desktop in Compare. The thinking state, errors and the live announcement appear in one place at a time, never two.

### 6.3 Options

**Purpose:** see a few real, different products and why each might or might not suit you.

- Top line: Pica `found` at 24 and "4 options, in no particular order". Under it: "Prices, ratings and stock come from the catalog."
- **Pica's note.** When the shortlist carries a note (fewer fits than hoped, or a case for waiting or spending less), it shows under the top line as a white card tagged "Pica's read". This is where a reason to hold off is said, so it is never dropped.
- Cards sit in a grid that fits as many 280px-wide columns as the space holds, with a 12px gap: one on a phone, two from 640px, two or three in the desktop stage.

**The option card, closed:**

1. Photo, 1:1, radius 20, edge to edge at the top of the card.
2. The angle as a small label over the text block, not over the photo: "The light one", "The office one".
3. Product name (`body-lg` semibold), merchant (`body`, `ink-muted`), price, rating if the catalog has one.
4. **Why it fits you**: one line, tagged with its source.
5. **Why you might not want it**: one line, same size, same weight, same place on every card. This line is never hidden, cut short or greyed.
6. Three actions, each a full-width row 44px high, in this order: "See the evidence", "Compare" (a toggle), "Choose this one". All three are secondary. No button on the card is purple, larger or filled darker than the others.

"More" opens the card in place to show every fit line, every drawback, the value note and what is not verified.

**Price and stock on the card**

- The price is the price of the version the search matched, shown plain. The same figure opens on Decide. If other versions cost more or less, a second line gives the catalog's range: "Other versions cost $168 to $228".
- No struck-through price and no "sale" mark, even when the catalog gives a list price. A crossed-out price is a nudge.
- Stock is about that one version, and the card says so: "This version is sold out. Other sizes or colours may be in stock." "Choose this one" stays on, because Decide is where the buyer picks a version.
- When the catalog does not say, the card reads "Stock not confirmed". Never guess "In stock".

Rules:

- No card is bigger, first by rank, or badged as a pick. The order carries no meaning and the top line says so.
- "Choose this one" is a secondary button. The purple action lives on Decide.
- If needs changed after the shortlist was made, a caution banner sits above the cards: "Your needs changed after this shortlist", with "Update the options".
- Foot of the list: "None of these fit" and "End without buying", both secondary, the same size. "None of these fit" sends that message to Pica; the reply shows in the docked thread and Pica asks what is off or looks again.

### 6.4 Compare

**Purpose:** set two to five options against what you care about.

**How a comparison is made.** Pica writes it; the screen does not work it out.

- Pick options with the "Compare" toggle on each card, or from a row of small product thumbnails at the top of Compare. Two at least, five at most (the server's limit); the limits are said in words.
- One action starts it: "Compare these 3" (secondary; it names the count). It sits at the top of Compare, beside the thumbnails, and nowhere else. Only one ask shows at a time. If the picks differ from the table, it is "Compare these N". If they match and the table is out of date, it is the banner's "Update comparison". If they match and the table is current, there is no ask. It sends a message to Pica, which shows as the buyer's bubble in the docked thread on desktop; on a phone the docked thread shows the thinking row. While Pica works, the table area shows grey shapes under its heading, and the thinking row is in the docked thread, not in the table.
- Pica may also make a comparison from the chat without being asked through this button. It shows here the same way.
- Changing the picks after a table exists leaves the old table in place, marked "This comparison covers different options", with "Compare these 4".

**What shows**

- **Your needs, editable in place.** Above the table sits "What matters to you": your must-haves and nice-to-haves as chips. Tap one to edit or remove it, or add one. After a change the comparison shows "This comparison reflects your earlier needs" with one action, "Update comparison". Compare shows one caution banner at a time: if the picks also differ from the compared set, only "This comparison covers different options" shows.
- **Rows are Pica's choice.** Pica picks up to eight rows from the buyer's needs and words the labels itself. They need not match the chips one for one, and the screen does not pretend they do.
- **The table (desktop).** Row labels in a 128px column; product columns share the rest equally. Text wraps; nothing is cut. With the chat docked and the rail folded, five options fit at 1024px with columns of about 170px. The table is used only while each product column is 160px or wider; below that it falls back to stacked cards. It never scrolls sideways.
- **Stacked cards (phone).** One card per row of the comparison. Inside it, each option is a line with its thumbnail and name, the cell text and its tag.
- **Catalog rows first:** price, stock and rating. These are facts from the catalog, so they carry one note on the row, "From the catalog", and no tag in the cells.
- **Then Pica's rows.** Every cell has an evidence tag. A cell says "Merchant says" or "From the listing" only when a checked quote stands behind it; otherwise it is "Pica's read" or "Not verified". Tap a tag that has a quote and the quote opens beneath the cell.
- **Still open.** Under the table, a plain list of the open questions from the canvas, under the heading "Still open in your needs", with one line: "Ask Pica about any of these." No cells, and no claim per option.
- Pica's takeaway sits under that as a white card with a "Pica's read" tag. It lays out the tradeoff. It does not name a winner.
- Each column ends with "See the evidence" and "Choose this one".
- Foot of the view: "End without buying", secondary.

### 6.5 Evidence sheet

**Purpose:** show what stands behind the claims about one product.

It opens from Options, Compare and Decide: a bottom sheet on phone, a centred dialog from 640px. Title: "Where this comes from".

The four source kinds keep their words and icons everywhere in the app:

| Tag | Lucide icon | Meaning |
|---|---|---|
| Merchant says | `Store` | The merchant's own words, quoted |
| From the listing | `FileText` | Shopify's summary of the listing. The sheet's section heading spells this out: "From the listing, summarized by Shopify". |
| Pica's read | `Feather` | Pica's inference. Not a fact. |
| Not verified | `CircleDashed` | Nobody has checked this |

Catalog facts (price, stock, rating) carry the plain note "From the catalog" and no tag.

Order in the sheet: the merchant's description with a link, "See it on {merchant}", that opens the listing; the listing summary; the rating, with the note "Few reviews so far" when there are under 20; Pica's read; what is not verified; then "Look for independent reviews" with three links out (search the web, search Reddit, search YouTube) and one line: "These links open other sites. Pica does not check what they say."

Missing evidence is said plainly: "The merchant gives no description." An empty "Not verified" list reads: "Pica listed nothing here. That does not mean every claim was checked."

### 6.6 Decide

**Purpose:** look over one product and what it costs, then go to the merchant, save it, or drop it.

Single column, 640px at most. From the top:

1. The path, with Decide current. "Back to your options" above the card.
2. The product: photo, name, merchant, price in `heading`.
3. **The tradeoff, restated.** One white card that opens with the buyer's goal ("Your goal: ...") when one is set, then two lines taken from the shortlist: "Why it fits you" and "Why you might not want it", with their tags and a "See the evidence" link. The buyer sees the drawback one more time before paying.
4. Choices (size, colour) as chips. A sold-out choice is off and says "sold out". When stock is unknown: "Stock not confirmed. You can still continue; the merchant confirms at checkout."
5. "Checked 2:14 PM" under the price. If the check is old, the price and stock are checked again before checkout, and the screen says so: "Price and stock were checked again. Look them over, then continue."
6. Store policy links, or "The catalog lists no return or shipping policy for {merchant}."
7. Three buttons, stacked, full width, the same height: **"Continue to checkout"** (the one purple button), "Save for later", "End without buying" (both secondary). Under them: "You buy from {merchant} on their site. Nothing is bought until you pay there." A decision that has ended (bought, or ended without buying) shows none of the three: Decide shows the product, its tradeoff and one link, "See how this ended", to Done. The buyer reopens it from the workspace.

**Checkout takes two steps, and the screen shows both.** The app learns shipping, tax and the total only after it asks the merchant to start a checkout.

- **Before the press:** the price, and one line: "Shipping and tax show at the next step."
- **Press "Continue to checkout".** The button shows a busy state.
- **If the merchant sends back costs:** a cost card takes the place of that line, with subtotal, shipping, tax and total as given, and the time the quote runs out if there is one. The purple button now reads "Go to {merchant} to pay". Changing a choice clears the costs and brings back "Continue to checkout".
- **If the merchant sends back a link only:** the buyer goes straight to the merchant's site. The line under the buttons has already said so.
- Nothing asks the merchant for a checkout before the buyer presses.

"End without buying", here and anywhere else, opens a short sheet: "End this decision without buying?" with "End without buying" and "Keep deciding". You can reopen it later, and the sheet says so.

### 6.7 Done

**Purpose:** close the decision and ask, once, how sure the buyer feels.

- Pica at 120: `settled` for bought and for not buying, `resting` for saved.
- One `display` line: "You bought the {product}", "You decided not to buy", or "Saved for later".
- For not buying, one line: "Deciding not to buy is a real answer." Then reason chips under "Why not? (optional)": the six reasons the app already stores ("I don't need it after all", "Too expensive for what it is", "Nothing fit my needs", "What I have still works", "Buying somewhere else", "Not right now"). They show here and nowhere else.
- If checkout was started and the outcome is unknown, the screen opens with "Did you buy it?" with two answers: "Yes, I bought it" and "Not yet". There is no "No"; a buyer who has decided against it uses "End without buying". After "Not yet" the question goes away and stays away until the buyer starts checkout again.
- **Confidence check**: three short statements with Yes or No each (I know what I need; I can explain the tradeoffs; I'm confident in this choice). Optional, and labelled so. It saves once all three have an answer; answers so far stay on screen. An unanswered statement is never saved as "No". It shows for bought, not buying and saved for later (the PRD measures confidence to make or to defer a decision), never for a decision still open, and never while "Did you buy it?" is on screen.
- For bought: "Check in later" explains the check-in and where to find it.
- Links: "Start a new decision", "Back to this decision", "Saved".

### 6.8 Saved

**Purpose:** find a decision and pick it up.

- Groups: Open, Saved for later, Bought, Not buying. Empty groups do not show.
- Each card: thumbnail of the chosen or first option, title, stage facts ("3 needs · 4 options"), last changed date, one action ("Resume" or "Open"), and "Remove" in a menu. Remove asks first.
- One line under the heading: "Decisions are saved in this browser only."
- "Did you buy it?" shows on one card at a time: the one with the newest checkout still unanswered.
- Bought cards carry "Check in". The check-in sheet asks about each must-have the buyer stated, then overall, then an optional note.
- One line under Bought: "Pica can't see your orders. The merchant's email has your order status."
- Empty: Pica `resting`, "No decisions yet", "Start a decision".

### 6.9 Browse

**Purpose:** look at products directly, without the conversation.

- Category chips, a search field, then the grid: 2 columns on phone, 3 from 640px, 4 from 1024px.
- Tile: white card, 1:1 photo at radius 20, merchant in semibold `body`, name, price, rating.
- Each tile has one action, "Ask Pica about this". It starts a new decision about that product. It does not add the product to an open decision: an option with no "Why you might not want it" line from Pica would break the card's own rule.
- Tiles follow the price and stock rules of the option card: no struck-through price.
- No purple on this screen but the focus ring. Browse has no single main action; the products are the point.

### 6.10 Header

"Pica" with the mark at 32 on the left, linking home. "Browse" and "Saved" on the right. In the workspace, at every width, a menu in the header holds "Save for later" and "End without buying". The header never shows the decision's title; the page's own heading does, once. Those two actions do not show until the decision has at least one need. Decide and Done show no header menu: Decide has both actions on the page, where they save the chosen size or colour too, and on Done the decision is closed.

## 7. States

One pattern for each. Every state says what happened and what to do next (the phone's docked thread may cut a long reply to two lines; see 6.2).

**Whose words.** When the server sends an error, its message is already written for the buyer. Show it word for word; do not rewrite it on the client. Sort by where the message came from, never by testing its words: a problem reported inside Pica's reply or a search result shows in the chat or the docked thread as Pica's bubble; a failed request shows as a banner where the fault happened. The example words below are for states the client alone knows about, or quote the server's line.

Server lines are the one exception to two voice rules in section 8: some say "we" ("We couldn't reach the Shopify catalog. Try again in a minute."), and some call a size or colour an "option". They stay as sent in this round; this is a known limit.

| State | Pattern | Pose | Example words |
|---|---|---|---|
| Loading a screen | Grey shapes in the layout to come | none | — |
| Pica working | Inline row in the chat or the docked thread | `thinking` | "Pica is working on it" |
| Nothing yet | Centred: Pica at 120, a title, one line, one action | `idle`, `weighing` or `resting` by screen | "No options yet" / "Tell Pica what you need, or ask for products now." |
| No results in Browse | The same pattern | `unsure` | "No products match" / "Try another search or category." |
| No results in chat | Pica's bubble | `unsure` avatar | Server: "I didn't find matching products from Shopify merchants. Try fewer must-haves or a wider budget." |
| Catalog down, in chat | Pica's bubble when a search inside a reply fails; a banner in the chat with "Try again" when the request itself fails | `unsure` avatar on the bubble; `unsure` at 24 on the banner | Server: "We couldn't reach the Shopify catalog. Try again in a minute." |
| Catalog error outside chat | Banner on Browse or Decide, critical tone, with retry | `unsure` at 24 | Server's line, as sent |
| Pica can't reply | Banner in the chat, critical tone, with retry | `unsure` at 24 | Server: "Pica can't reply right now. Try sending your message again in a moment." |
| Too many messages | Banner in the chat, caution tone | `unsure` at 24 | Server: "You've sent a lot of messages in a short time. Wait a few minutes, then try again." Action: "Try again". |
| Message too long | Field error under the composer; the text stays | none | Server: "That message is too long. Shorten it and send again." |
| Conversation full | Banner in the chat with "Start a new decision"; the composer is off. Needs do not carry over in this round, and the banner does not say they do. | `unsure` at 24 | Server: "This conversation is too long for Pica to read. Start a new one to keep going." |
| Pica not set up | The "nothing yet" pattern in place of the chat | `unsure` | Server: "Pica isn't set up yet. Add your OpenAI key on Home, or try the demo." Button: "Go to Home". |
| No reply came | Banner in the chat | none | "Your last message has no reply yet." / "Send again" |
| Needs changed | Caution banner over Options. Compare shows its own banner instead (6.4), one at a time: "covers different options" when the picks differ, else "reflects your earlier needs" | none | Options: "Your needs changed after this shortlist" / "Update the options". Compare: "This comparison reflects your earlier needs" / "Update comparison" |
| Price may be old | A line under the price | none | "Checked 2:14 PM" / "Price and stock may have changed. Checked yesterday." |
| Choice gone | Banner on Decide | `unsure` at 24 | "That size or colour isn't available. Your earlier choice is still selected." |
| Sold out | Words beside the price; the choice is off | none | "This choice is sold out. Pick another size or colour, or another option." |
| Stock unknown | Words beside the price | none | "Stock not confirmed" |
| Checkout failed | Banner above the button, with retry | `unsure` at 24 | "Checkout with {merchant} didn't start. Try again." |
| Back from checkout | A card at the top of the screen | `idle` | "Did you buy it?" |
| Storage blocked | Caution banner under the header | none | "Changes aren't being saved. Your browser is blocking storage for this site." |
| Not found | The "nothing yet" pattern | `unsure` | "This decision isn't saved in this browser" / "Start a new one" |

## 8. Voice

`DESIGN.md` section 7 holds. These rules are Pica's own.

- **Name.** The product is "Pica" everywhere: header, page titles, messages. Not "Shop Companion".
- **Who speaks.** Inside the chat and the docked thread, Pica says "I". Everywhere else the interface speaks plainly and names Pica in the third person: "Pica looks across products from Shopify merchants." The interface's own strings never say "we"; lines the server sends are the exception noted in section 7.
- **Two kinds of thing, two words.** An **option** is a product on the shortlist. A **choice** is a size or colour of it. Never use one word for both.
- **Every question earns its place.** A question from Pica comes with one line on why it changes the answer.
- **Limits out loud.** Pica says what it cannot see or check, in plain words, where the buyer needs it.
- **No winner words.** Never "best", "perfect", "top pick", "recommended", "winner", a percent match, or a star from Pica. Pica describes fit and tradeoff; the buyer picks.
- **No unchecked figures.** Pica's "why this matters" line gives a reason, not a number nobody counted.
- **No pressure.** No "hurry", "only X left", "don't miss", "limited time". No guilt at leaving.
- **The same words for the same thing.** Goal (what the buyer wants to be true; not intent or outcome, in the interface), needs (not requirements), options (not results or the shortlist, in the interface), "Confirm" for a guess, "Choose this one", "Continue to checkout", "Save for later", "See the evidence". Every button that ends a decision reads "End without buying"; "Not buying" is only the name of the outcome, on Saved and the path.
- **The test.** Today `src/features/banned-words.test.ts` scans `src/app` and `src/features` only and has no pattern for "perfect" alone, "top pick", "recommended" or "winner". The rebuild adds `src/components` to its roots and adds those four patterns.

Sample lines:

| Moment | Write |
|---|---|
| Home heading | What does your life look like after you get your ideal bag? |
| A product opener | What's it for? Why this matters: the trip or the commute decides the size. |
| Why a question matters | Why this matters: a 16-inch laptop doesn't fit many work bags. |
| Options arrive | 4 options, in no particular order |
| The drawback label | Why you might not want it |
| Pica cut its own line | I cut a line that read like a sales pitch. Ask me about any tradeoff and I'll lay it out plainly. |
| Checkout handoff | You buy from {merchant} on their site. Nothing is bought until you pay there. |
| Not buying | Deciding not to buy is a real answer. |

## 9. Accessibility

The bar is WCAG 2.1 AA.

- Tap targets are 44px or more, chips included (a 32px chip sits in a 44px hit area).
- Text meets 4.5:1 on the background it sits on. Use `ink-soft`, not `ink-muted`, for secondary text of any size on `canvas`.
- A 2px purple focus ring with a 2px offset shows on every control.
- Status is never colour alone: each tag, banner and stage has a word or an icon, and a selected control has a check icon and a border as well as its fill.
- Sheets hold focus, close on Escape and send focus back to what opened them.
- The path, the bottom bar and the chips work from the keyboard. The bottom bar is a `nav` of links, not a tab list.
- A reply from Pica is announced politely, once, when it has finished arriving, not word by word. Errors use `role="alert"`. Notes, the summary strip's hidden region and caution banners use `role="status"`; the role never sits on a button or link.
- Product photos carry the product's name as alt text. Pica is hidden from screen readers except in `thinking`.
- All motion stops under reduced motion.
- The layout holds at 320px wide with no sideways scroll, and at 200% text size. At either, fixed bars may take no more than half the screen (see 6.2).

## 10. Kit

The parts the screens are built from. Each one ships with every state shown on `/kit`.

- **Controls:** Button (primary, secondary, ghost; loading; link), IconButton, Chip (toggle, one-shot, removable), TextInput, TextArea, IntentInput.
- **Surfaces:** Card, Sheet, Banner (info, caution, critical), Skeleton, EmptyState.
- **Commerce:** ProductImage, Price, Rating, ProductSummary (thumbnail, name, merchant, price in one row).
- **Trust:** EvidenceTag (four kinds), SourceTag (two kinds).
- **Wayfinding:** StagePath, BottomBar, SummaryStrip.
- **Pica:** Pica (eight poses), PicaAvatar, PicaThinking.

**Rules for the rebuild**

- The screens are new; what they do is not. Every analytics event the current screens send (goal stated, edits to needs, answers and skips, options viewed, comparison viewed, evidence and review links opened, checkout started, purchase, not buying, satisfaction, errors shown) must still be sent, once each, from the new ones.
- Server code, stored data and the wording the server sends stay as they are.
- Price shows through one part, Price, which has no struck-through form.

## 11. Check before you ship a screen

Add these to the list in `DESIGN.md` section 8.

- Can the buyer see or reach their needs in one tap from here?
- Does every claim about a product carry a source tag?
- Is "Why you might not want it" as easy to see as "Why it fits you"?
- Is there a way to leave without buying, and is it as plain as the way to buy?
- Does the screen avoid ranking, scoring or crowning a product?
- Is Pica's pose the right one for this state, and is there only one Pica in view?
- If you send a message here, do you stay here?
- Is every selected or current thing marked by more than its fill?
- Does it hold at 320px, at 360px with the keyboard open, at 1024px, 1280px and 1440px?

## 12. Known limits

- No dark mode.
- Inter stands in for GT Standard, Shop's paid typeface.
- Order status is not shown; Pica cannot see orders.
- Quantity is fixed at one.
- Row labels in a comparison are Pica's words. The buyer edits the needs behind them, not the labels.
- Decisions live in one browser. They do not follow the buyer to another device.
- A product found in Browse cannot join an open decision; it starts a new one.
- A conversation that grows too long must start again, and its needs do not carry over.
- Lines the server sends keep their wording, "we" and "option" for a size or colour included.
