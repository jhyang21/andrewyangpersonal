# Product Requirements Document

## Pica: Bags, Backpacks & Luggage

**Version:** 1.0 | **Status:** MVP for engineering handoff
**Platform:** Responsive Next.js web application deployed on Vercel
**LLM:** OpenAI GPT-6 Luna (`openai/gpt-6-luna`)
**Commerce:** Shopify Catalog API (Global Catalog MCP) + Universal Commerce Protocol (UCP)

---

### 1. Product Overview

**Vision:** Start from what the customer wants to be true, and help them figure out what's worth buying to get there, not just what to buy.

Build an AI-powered shopping companion that starts from the customer's goal ("two weeks in Japan without checking a bag"), works back to what that goal takes, and helps customers discover their requirements, understand product tradeoffs, and confidently choose products that fit their functional needs, lifestyle, identity, and budget.

Unlike conventional ecommerce search or AI recommendation chatbots, the product prioritizes **collaborative decision-making over immediate product recommendations**.

The MVP focuses exclusively on bags, backpacks, and luggage, with real Shopify merchant products and a path to checkout.

### 2. Problem & Product Hypotheses

**Problem:** Customers shop to reach a goal, not to own a specification: a trip with one bag, a commute that no longer makes a shoulder ache. Search and most AI tools ask them to name a product first, so the customer does the work of turning the goal into requirements. They spend considerable time refining their needs, comparing options, and validating recommendations through independent reviews.

Traditional search emphasizes filtering. AI shopping tools often recommend products prematurely, before sufficiently understanding the customer.

**Core hypotheses:**

1. Customers prefer AI to support purchasing decisions rather than make decisions for them.
2. Customers evaluate products through personalized definitions of value, including functionality, aesthetics, identity, status, and price.
3. Co-discovering requirements and making tradeoffs explicit leads to more confident purchasing decisions.
4. Trust and satisfactory outcomes drive long-term repeat usage more effectively than aggressive conversion optimization.

**Product principle:** Earn the next purchase. Don't force the current one.

### 3. Target Users & Scope

**Primary user:** A shopper considering a bag, backpack, or luggage purchase who hasn't fully determined what they need or whether a particular product is worth the price.

**Supported shopping contexts:**

- Bags: daily use, work, fashion, travel, and gifting.
- Backpacks: commuting, school, laptops, outdoor activities, and travel.
- Luggage: carry-on, checked luggage, short trips, extended travel, and frequent flying.

**Initial market assumption:** U.S. consumers, English language, USD.

**Core job to be done:**

"When there's something I want a bag or luggage to do for me, start from that goal, help me figure out what it takes, understand my choices, and decide what's worth my money without pressuring me to buy."

### 4. Core User Experience

The experience follows six moments:

| Stage                       | User experience                                                    |
| --------------------------- | ------------------------------------------------------------------ |
| 1. State the goal           | Say what you want to be true, even without naming a product        |
| 2. Co-discover requirements | AI works back from the goal, asks relevant questions, sets priorities |
| 3. Discover options         | See a small, differentiated shortlist of actual products           |
| 4. Evaluate worth           | Compare personal fit, tradeoffs, evidence, and prices              |
| 5. Make a decision          | Purchase, save for later, continue exploring, or decide not to buy |
| 6. Validate outcome         | Report whether the purchased product satisfied the original need   |

**Example user journey:**

User: "I bike to work with a laptop and my shoulder hurts by Friday. I don't want to spend more than $200."

AI: "What matters more on the ride: keeping the load off that shoulder, or keeping the laptop dry?"

The user responds, and the interface keeps the goal on top and updates the requirements under it. A user who opens with a product ("a work backpack under $200") is first asked what it's for.

The AI presents three different backpack options, explaining against the goal why each might be worth considering, where each falls short, and what paying more actually provides.

The user examines evidence, adjusts priorities, chooses a product, and proceeds to merchant checkout.

### 5. MVP Functional Requirements

All requirements below are **P0** unless noted otherwise.

| ID    | Feature                   | Requirements                                                                                                                                                                                                     |
| ----- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Natural-language shopping | Users can state a goal or a need in free text without predefined specifications. When a user names only a product, the AI asks what it's for. They can also browse products directly.                                                                                                  |
| FR-02 | Adaptive co-discovery     | GPT Luna asks context-aware clarifying questions, generally 2–4 high-value questions before presenting options. Users can skip questions, change answers, or request products immediately.                       |
| FR-03 | Living decision canvas    | Display the customer's goal first, then an editable summary of the must-haves, preferences, budget, and unresolved questions that follow from it. Clearly distinguish user-stated requirements from AI inferences.                                               |
| FR-04 | Real product discovery    | Retrieve actual bags, backpacks, and luggage through Shopify Global Catalog MCP. Display merchant, imagery, prices, variants, and availability where provided.                                                   |
| FR-05 | Personalized shortlist    | Present approximately 3–5 differentiated products, with explanations of fit, advantages, drawbacks, and value relative to the user's priorities.                                                                 |
| FR-06 | Product comparison        | Enable side-by-side comparison of price, relevant specifications, aesthetics, functional suitability, and tradeoffs. Users can change priorities and reevaluate the shortlist.                                   |
| FR-07 | Trust and verification    | Separate verified product facts from AI interpretations. Display source-linked supporting evidence when available, surface negative evidence and uncertainties, and provide paths to independent reviews.        |
| FR-08 | Purchase flow             | Allow users to select a specific product and variant, review costs, and initiate checkout through UCP. The customer must explicitly authorize purchase completion. Use merchant checkout handoff where required. |
| FR-09 | Save or decline           | Support saving a decision session, returning later, and concluding without purchasing. Browsing must not require account creation.                                                                               |
| FR-10 | Outcome feedback          | After a completed purchase, offer available order-status access and an optional satisfaction check-in tied to the customer's original requirements.                                                              |

**Category-specific discovery examples:**

- **Bags:** intended occasion, style, capacity, materials, organization, social context.
- **Backpacks:** laptop size, daily load, commute, ergonomic comfort, weather resistance, appearance.
- **Luggage:** trip duration, airline requirements, carry-on dimensions, weight, capacity, wheels, durability.

The AI should prioritize questions that materially change product suitability rather than ask for every possible attribute.

### 6. UI/UX Requirements

**Design direction:** Clean, visually driven, conversational, and exploratory. The experience should resemble a thoughtful shopping companion, not a long questionnaire or conventional sales funnel.

**Core screens:**

1. **Home / Goal Entry:** Prominent natural-language input that asks what life looks like once the customer has the right bag, with examples such as "Two weeks in Japan without checking a bag" or "My shoulder no longer aches after the commute".
2. **Discovery Workspace:** Conversational AI alongside a continuously updated decision canvas.
3. **Product Shortlist:** Visual product cards explaining "Why it fits you" and "Why you might not want it."
4. **Comparison & Evidence:** Side-by-side product evaluation with editable priorities, grounded evidence, and unresolved concerns.
5. **Decision & Checkout:** Clear product selection, price review, merchant checkout, and save-for-later options.
6. **Saved Decisions / Outcomes:** Resume previous decisions and provide optional post-purchase feedback.

**Interaction principles:**

- Show progress without forcing users through fixed steps.
- Keep inferred requirements transparent and editable.
- Allow customers to move between conversation, product browsing, and comparisons.
- Avoid unexplained match percentages or unsupported claims such as "best product."
- Present meaningful alternatives rather than several nearly identical recommendations.
- Never use artificial urgency, misleading scarcity, or guilt-based conversion prompts.
- Design mobile-first, with a usable desktop comparison experience.

### 7. AI Behavior & Trust Guardrails

GPT Luna should operate as a **collaborative shopping researcher**, not an autonomous buyer or salesperson.

**Required behaviors:**

- Clarify consequential uncertainties before confidently recommending.
- Explain why a question matters to the purchasing decision.
- Treat customer preferences as provisional and revisable.
- Ground product recommendations in actual catalog results.
- Explain tradeoffs, disadvantages, and reasons to defer a purchase.
- Distinguish merchant claims, independent evidence, and AI inference.
- Clearly communicate when information is missing or cannot be verified.
- Acknowledge that Shopify Catalog coverage is not the entire retail market.
- Never fabricate products, prices, reviews, ratings, availability, or policies.
- Never place an order without explicit user approval.

**Trust principle:** Recommending a cheaper item, buying later, or not buying at all are valid successful outcomes.

### 8. Success Metrics

**Primary North Star: Confident Decision Rate**

Percentage of completed shopping journeys where users report that they understand their requirements, can explain the key tradeoffs, and feel confident in their chosen course of action, including not purchasing.

**Supporting metrics:**

| Metric                    | Purpose                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| Requirement understanding | Does the customer feel understood by the AI?                     |
| Decision confidence       | Is the shopper confident enough to make or defer a decision?     |
| Evidence usefulness       | Did verification help the customer evaluate the choice?          |
| Product satisfaction      | Did the product satisfy the original requirements after use?     |
| Repeat shopping usage     | Do customers return for subsequent shopping decisions?           |
| Checkout completion       | Can customers successfully transition from decision to purchase? |

Instrument key journey events including the stated goal, requirement edits, recommendation views, comparison activity, evidence views, checkout initiation, completed purchase, no-purchase decisions, and satisfaction feedback.

MVP success targets should be calibrated through an initial usability pilot against conventional search and standard AI recommendation chat.

### 9. Acceptance Criteria & Release Readiness

The MVP is ready for pilot testing when:

- A user can complete the full discovery-to-checkout journey for each of the three product categories.
- Vague requests result in relevant clarification rather than premature generic recommendations.
- Requirements can be edited and changes affect subsequent recommendations.
- Displayed products correspond to real Shopify Catalog records.
- Users can distinguish factual product information from inferred suitability.
- Missing evidence and unsupported claims are not presented as verified.
- Checkout uses UCP and requires explicit customer action.
- The experience gracefully handles empty results, unavailable variants, failed API requests, and checkout errors.
- Users can save, resume, or exit without buying.
- Basic analytics capture the full decision journey and available post-purchase outcomes.

### 10. Explicitly Out of Scope

- Integration with Dots, Muse, ChatGPT, or other external personal assistants.
- Autonomous purchasing or recurring automatic orders.
- Product categories outside bags, backpacks, and luggage.
- Comprehensive consumer preference memory across unrelated shopping categories.
- Automated scraping or unlicensed aggregation of Reddit, Amazon, or third-party reviews.
- A proprietary universal product review database.
- Multi-merchant unified checkout.
- Merchant dashboards, ad placements, or sponsored recommendation optimization.
- Advanced returns automation or full customer support operations.

### 11. Key Dependencies & Risks

**Shopify integrations:** Catalog discovery through Global Catalog MCP and transactional flows through UCP are mandatory. Order tracking and satisfaction follow-up may depend on order-access permissions and available lifecycle signals.

**Independent evidence:** Shopify Catalog product facts alone will not establish independent product quality. The MVP must transparently distinguish available evidence from missing evidence.

**Product attributes:** Category-specific information such as laptop fit, carrying comfort, airline restrictions, and long-term durability may be incomplete or difficult to verify.

**AI quality:** Poorly targeted questions, unsupported product-fit conclusions, or excessive conversation length could make the experience worse than ordinary search.

**Customer trust:** Monetization and recommendation incentives must not undermine the credibility of the shopping advice.

### 12. MVP Launch Objective

Demonstrate that a Shopify-powered, AI-assisted shopping experience can help customers move from **a goal in their own words to clear requirements, informed product evaluation, and a confident purchasing decision**, with greater perceived trust and decision quality than conventional search or generic AI recommendations.

The MVP should validate the co-discovery and trust-first experience before expanding categories or exposing these capabilities to external personal assistants.

**The guiding question for every design and product decision:**

*Does this help the customer understand what's worth buying, or does it simply make it easier to sell them something?*
