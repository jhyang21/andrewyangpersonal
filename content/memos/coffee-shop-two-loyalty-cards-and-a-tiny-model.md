---
title: "A Coffee Shop, Two Loyalty Cards, and a Tiny Model"
date: "2026-06-09"
summary: "Paper punch cards vs. digital loyalty at two cafés — a simple model for when Toast beats cardboard."
revision_1_date: "2026-06-09"
revision_1_note: "First version"
revision_2_date: "2026-06-09"
revision_2_note: "Expanded full derivation"
---

The café I work at uses an electronic loyalty program through Toast, while the café down the street that I frequent still uses a paper stamp card.

This got me wondering which system is actually better for the business.

As a customer, digital loyalty seems obviously superior. I never have to remember a card. Every purchase gets recorded automatically. There's no chance of finding a half-filled punch card buried in an old wallet months later.

But from the café's perspective, the answer is less obvious.

A digital loyalty program ensures every qualifying purchase gets tracked. As a result, more customers eventually redeem their free drinks. Paper cards are less efficient. Customers forget them, lose them, or simply fail to present them at checkout. Those missing stamps translate into fewer rewards redeemed. But also, realizing that they forgot their loyalty card, a customer might simply decide to not go.

So which effect is larger?

The extra rewards given away, or the extra visits retained?

---

## The Tradeoff

A digital loyalty system creates two opposing effects.

First, it prevents lost visits.

Suppose a customer realizes they've forgotten their paper card. They might still buy coffee. Or they might think, "I'll come back tomorrow when I have my card."

Second, it increases reward redemption.

Every visit is recorded, meaning more customers eventually earn their free drink.

The question boils down to whether the additional visits outweigh the additional rewards.

---

## A Simple Model

We will assume a loyalty program of:

> Buy 10 drinks, get 1 free.

Define:

- **M**: profit from a paid visit
- **R**: cost of a free reward drink
- **f**: probability a customer forgets their paper card
- **s**: probability a customer skips the café after forgetting their paper card

Now compare the expected profit from one possible visit.

---

## Electronic Loyalty

With electronic loyalty, the customer does not forget their card. If they visit, the café earns the normal profit:

$$
M
$$

But because every visit is tracked, every visit also moves the customer one-tenth of the way toward a free drink.

So the expected reward cost per visit is:

$$
\frac{R}{10}
$$

Therefore, expected profit under electronic loyalty per visit is:

$$
M - \frac{R}{10}
$$

---

## Paper Loyalty

With paper loyalty, there are two cases.

### Case 1: The customer does not forget the card

This happens with probability:

$$
1-f
$$

They visit and receive a stamp.

Profit from the visit:

$$
M
$$

Reward cost from the stamp:

$$
\frac{R}{10}
$$

So profit in this case is:

$$
M - \frac{R}{10}
$$

Weighted by probability:

$$
(1-f)\left(M-\frac{R}{10}\right)
$$

### Case 2: The customer forgets the card

This happens with probability:

$$
f
$$

If they forget, they might skip the café. That happens with probability:

$$
s
$$

If they skip, profit is:

$$
0
$$

If they do not skip, which happens with probability:

$$
1-s
$$

they still buy coffee, but they do not receive a stamp.

Profit is simply:

$$
M
$$

So the expected profit after forgetting is:

$$
s(0)+(1-s)M
$$

which simplifies to:

$$
(1-s)M
$$

Weighted by the probability of forgetting:

$$
f(1-s)M
$$

---

## Total Paper Profit

Add the two paper-card cases:

$$
(1-f)\left(M-\frac{R}{10}\right)+f(1-s)M
$$

Now expand:

$$
(1-f)M-(1-f)\frac{R}{10}+fM-fsM
$$

Group the $M$ terms:

$$
(1-f)M+fM-fsM-(1-f)\frac{R}{10}
$$

Since:

$$
(1-f)M+fM=M
$$

paper loyalty expected profit becomes:

$$
M-fsM-(1-f)\frac{R}{10}
$$

or:

$$
M(1-fs)-(1-f)\frac{R}{10}
$$

---

## Comparing Electronic and Paper

Electronic is better when:

$$
M-\frac{R}{10} > M(1-fs)-(1-f)\frac{R}{10}
$$

Now expand the right side:

$$
M-\frac{R}{10} > M-fsM-\frac{R}{10}+f\frac{R}{10}
$$

Subtract $M$ from both sides:

$$
-\frac{R}{10} > -fsM-\frac{R}{10}+f\frac{R}{10}
$$

Add $\frac{R}{10}$ to both sides:

$$
0 > -fsM+f\frac{R}{10}
$$

Move the right side terms around:

$$
fsM > f\frac{R}{10}
$$

Assuming $f>0$, divide both sides by $f$:

$$
sM > \frac{R}{10}
$$

or:

$$
Ms > \frac{R}{10}
$$

This has a straightforward interpretation:

> The profit recovered from saved visits must exceed the cost of the additional rewards that get redeemed.

---

## Simplifying Further

For a coffee shop, the cost of a reward drink is essentially its ingredient cost.

Let:

$$
\alpha = \frac{\text{COGS}}{\text{Profit}}
$$

That means:

$$
R = \alpha M
$$

Substitute that into the condition:

$$
Ms > \frac{\alpha M}{10}
$$

Assuming $M>0$, divide both sides by $M$:

$$
s > \frac{\alpha}{10}
$$

This is the part I like.

The profit per drink disappears.

The card-forgetting rate disappears.

The entire decision reduces to a single behavioral variable.

---

## Plugging in Real Numbers

A typical coffee shop might have COGS between 20% and 35% of revenue.

If COGS is 20%, profit is 80%, so:

$$
\alpha=\frac{0.20}{0.80}=0.25
$$

If COGS is 35%, profit is 65%, so:

$$
\alpha=\frac{0.35}{0.65}\approx0.54
$$

So:

$$
\alpha \approx 0.25 \text{ to } 0.54
$$

Substituting into:

$$
s > \frac{\alpha}{10}
$$

gives:

$$
s > \frac{0.25}{10}=0.025
$$

and:

$$
s > \frac{0.54}{10}=0.054
$$

So:

$$
s > 2.5\% \text{ to } 5.4\%
$$

In other words:

> A digital loyalty program is economically superior if more than roughly 3–5% of customers who forget their paper card would have skipped the visit.

That's a surprisingly low threshold.

Only about 1 customer out of 20 to 40 needs to change their behavior after forgetting their loyalty card for digital loyalty to come out ahead.

---

When I first thought about this question, I assumed the key variable would be how often customers forget their loyalty cards.

Instead, what matters is not whether customers forget, but what they do after forgetting.