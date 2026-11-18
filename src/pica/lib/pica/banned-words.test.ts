/**
 * Pica must not sell. This test checks that:
 * - the prompt's avoid list names every banned phrase,
 * - the rest of the prompt, the fixed strings and the tool descriptions use none,
 * - the text guard catches them in model-written text.
 */
import { describe, expect, it } from "vitest";
import { PICA_MESSAGES } from "./constants";
import { AVOID_END, AVOID_LIST, AVOID_START, buildInstructions } from "./prompt";
import { NO_TURN_READ } from "./decisions";
import { digestProduct } from "./digest";
import {
  amountsIn,
  buyerAmountsIn,
  checkReplyText,
  createKnownPrices,
  findBannedText,
  findPressure,
  splitSentences,
  stripLinks,
} from "./text-guard";
import { createPicaTools } from "./tools";
import { makeProduct, makeSession } from "./test-helpers";

const REQUIRED_IN_AVOID_LIST = ["best", "perfect match", "hurry", "only X left", "don't miss"];

/** Banned in Pica's own words: the brief's list plus Shop's voice rules. */
const BANNED = [
  /\bbest\b/i,
  /\bperfect( match)?\b/i,
  /\bhurry\b/i,
  /\bonly \w+ left\b/i,
  /\bdon'?t miss\b/i,
  /\d+\s?%\s?(match|fit)/i,
  /\bsuccessfully\b/i,
  /\bsimply\b/i,
  /\bjust\b/i,
  /\beasy\b/i,
  /\boops\b/i,
];

function promptWithoutAvoidList(): string {
  const prompt = buildInstructions({ session: makeSession(), questionsAsked: 0, turnRead: NO_TURN_READ });
  const start = prompt.indexOf(AVOID_START);
  const end = prompt.indexOf(AVOID_END);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return prompt.slice(0, start) + prompt.slice(end + AVOID_END.length);
}

function hits(text: string): string[] {
  return BANNED.filter((pattern) => pattern.test(text)).map(String);
}

describe("banned words", () => {
  it("the avoid list names every banned phrase, including match percentages", () => {
    for (const phrase of REQUIRED_IN_AVOID_LIST) expect(AVOID_LIST).toContain(phrase);
    expect(AVOID_LIST.some((phrase) => phrase.includes("%") && /match/.test(phrase))).toBe(true);
  });

  it("the rest of the prompt uses none of them", () => {
    expect(hits(promptWithoutAvoidList())).toEqual([]);
  });

  it("the prompt also stays clean when the questions run out and the canvas changed", () => {
    const prompt = buildInstructions({
      session: makeSession({ shortlistProductIds: ["p-1"], canvasChangedSinceShortlist: true }),
      questionsAsked: 4,
      turnRead: { scope: "out_of_scope", ready: true },
    });
    const outside = prompt.slice(0, prompt.indexOf(AVOID_START)) + prompt.slice(prompt.indexOf(AVOID_END));
    expect(hits(outside)).toEqual([]);
  });

  it("the rest of the prompt also passes the text guard's pressure rules", () => {
    expect(findPressure(promptWithoutAvoidList())).toEqual([]);
  });

  it("Pica's fixed strings use none of them", () => {
    for (const message of Object.values(PICA_MESSAGES)) {
      expect(hits(message)).toEqual([]);
      expect(findBannedText(message), message).toEqual([]);
    }
  });

  it("Pica's fixed strings lead with what the buyer sees, not system terms", () => {
    const systemTerms = /\b(api|key|server|openai|env|config|error|invalid|request|status)\b/i;
    for (const message of Object.values(PICA_MESSAGES)) {
      const firstSentence = message.split(/(?<=[.!?])\s/)[0];
      expect(firstSentence, message).not.toMatch(systemTerms);
    }
  });

  it("the tool descriptions use none of them", () => {
    const { tools } = createPicaTools({ session: makeSession(), questionsAsked: 0 });
    for (const tool of Object.values(tools)) {
      expect(typeof tool.description).toBe("string");
      expect(hits(String(tool.description))).toEqual([]);
    }
  });

  it("the text guard catches pressure and catalog facts", () => {
    for (const text of [
      "The best pick for you",
      "A perfect match",
      "92% match",
      "Fit score: 88%",
      "Hurry, only 3 left",
      "Don't miss this one",
      "A top-rated pack",
      "My top pick",
      "The top picks this week",
      "The #1 carry-on",
      "The best-selling tote",
    ]) {
      expect(findPressure(text), text).not.toEqual([]);
    }
    for (const text of [
      "Costs $129",
      "About 129 dollars",
      "Rated 4.5 stars",
      "4.8/5",
      "A 4.6-star backpack",
      "In stock now",
      "It's in-stock in black",
      "Sold-out in navy",
      "See https://x.example",
    ]) {
      expect(findBannedText(text), text).not.toEqual([]);
    }
  });

  it("the text guard catches every avoid-list phrase it is meant to", () => {
    // Voice words stay with the prompt: the guard would reject honest text.
    const promptOnly = new Set(["successfully", "simply", "just", "easy", "oops"]);
    const example: Record<string, string> = {
      "only X left": "only 2 left",
      "percentages used as match or fit scores, such as 92% match": "92% match",
    };
    for (const phrase of AVOID_LIST) {
      if (promptOnly.has(phrase)) continue;
      const text = `It's the ${example[phrase] ?? phrase} for you`;
      expect(findPressure(text), phrase).not.toEqual([]);
    }
  });

  it("the text guard lets plain, honest text through", () => {
    for (const text of [
      "The lighter option",
      "Fits a 16-inch laptop, going by the listing",
      "fits a 16-inch laptop",
      "A 15 L main pocket and 2 side pockets",
      "100% nylon shell",
      "The cheapest of the three, and the straps are thinner",
      "Durability isn't verified",
      "It's just under your budget and easy to carry",
      "Simply put, the straps are thin",
      "Stockholm-style canvas",
      "Top pocket for keys",
    ]) {
      expect(findBannedText(text), text).toEqual([]);
    }
  });

  it("reads money amounts as numbers", () => {
    const amounts = amountsIn("$200, $200.00, 200 dollars, € 1,250.50 and 45 USD");
    expect(amounts.sort((a, b) => a - b)).toEqual([45, 200, 200, 200, 1250.5]);
    expect(amountsIn("Fits a 16-inch laptop with 2 pockets")).toEqual([]);
  });

  it("lets an amount the buyer gave through, in any written form", () => {
    const allowedAmounts = [200];
    for (const text of ["I'll look under $200", "Under your $200.00 limit", "Below 200 dollars"]) {
      expect(findBannedText(text, { allowedAmounts }), text).toEqual([]);
    }
  });

  it("blocks an amount the buyer never gave", () => {
    expect(findBannedText("This one is $129", { allowedAmounts: [200] })).toEqual(["a price"]);
    expect(findBannedText("Under $200")).toEqual(["a price"]);
  });

  it("catches the rating and price strings the digest gives the model", () => {
    const one = digestProduct(makeProduct({ id: "p-1" }));
    const range = digestProduct(
      makeProduct({
        id: "p-2",
        priceRange: { min: { amount: 12900, currency: "USD" }, max: { amount: 14999, currency: "USD" } },
      }),
    );
    const cad = digestProduct(
      makeProduct({
        id: "p-3",
        priceRange: { min: { amount: 12900, currency: "CAD" }, max: { amount: 12900, currency: "CAD" } },
      }),
    );
    for (const text of [one.rating!, one.price, range.price, cad.price]) {
      expect(findBannedText(text), text).not.toEqual([]);
      expect(checkReplyText(`It has ${text}.`).facts, text).not.toEqual([]);
    }
  });

  it("catches ratings and prices written in other common ways", () => {
    for (const text of [
      "from 120 reviews",
      "1,200 ratings",
      "a 4.6 rating",
      "rated 4.6",
      "costs 129",
      "priced at 129.99",
      "129 USD",
      "USD 129",
    ]) {
      expect(findBannedText(text), text).not.toEqual([]);
    }
    for (const text of ["Fits a 16-inch laptop", "2 compartments", "fits 3 days of clothes", "A 15 L main pocket"]) {
      expect(findBannedText(text), text).toEqual([]);
    }
  });

  it("reads each number in a buyer's message that is not a measure", () => {
    expect(buyerAmountsIn("My budget is 200")).toEqual([200]);
    expect(buyerAmountsIn("Something between 100 and 150, for 3 days away")).toEqual([100, 150]);
    expect(buyerAmountsIn("My limit is 200")).toEqual([200]);
    expect(buyerAmountsIn("200 max")).toEqual([200]);
    expect(buyerAmountsIn("150-200")).toEqual([150, 200]);
    expect(buyerAmountsIn("$150-200")).toEqual([150, 200]);
    expect(buyerAmountsIn("About 1,250.50 at most")).toEqual([1250.5]);
  });

  it("checks replies for sales claims, not plain speech", () => {
    for (const text of [
      "That's the best I can tell from the listing.",
      "I'll do my best to find one.",
      "At best it's a guess.",
      "That's perfectly fine.",
      "Which is best depends on your commute.",
      "Perfect, I'll look for those.",
    ]) {
      expect(checkReplyText(text).pressure, text).toEqual([]);
    }
    for (const text of [
      "This is the best bag for you.",
      "It's the best.",
      "The rolltop is best for rain.",
      "The best of the three.",
      "It's perfect for you.",
      "The perfect choice for commuting.",
      "The top pick.",
    ]) {
      expect(checkReplyText(text).pressure, text).not.toEqual([]);
    }
  });

  it("blocks text with one allowed and one unknown amount", () => {
    expect(findBannedText("Under your $200 limit, at $149", { allowedAmounts: [200] })).toEqual(["a price"]);
  });
});

/**
 * The third review's example inputs, one by one. A wording filter can't be
 * complete; these are the forms it should get right.
 */
describe("third review: narrower rules and added misses", () => {
  it("lets honest text through", () => {
    for (const text of [
      "I can't see whether it's in stock.",
      "Check the card in case it's sold out.",
      "If it's sold out in black, the navy is the same bag.",
      "I can't see whether it's on sale.",
      "It has 2 of 5 pockets padded.",
      "The frame is rated at 20 kg.",
      "Rated at 30 L, it fits a week.",
      "It has 2 out of 5 pockets padded.",
      "Which one works best for you?",
      "What's best for rain depends on the zips.",
      "I can't call one best for you.",
      "I won't call either of them best overall.",
      "Only the strap is left to decide.",
      "It fits a 16 inch laptop.Co-branded with a ski club.",
      "Weighs 1.2kg.Store it flat.",
      "Fits sizes 5/10 in the shoe pocket.",
      "The Rucksack No. 1 has a padded back.",
      "That's the best I can tell.",
      "Fits a 16-inch laptop",
      "2 compartments",
      "fits 3 days of clothes",
    ]) {
      expect(findBannedText(text), text).toEqual([]);
    }
  });

  it("blocks the forms it missed", () => {
    const cases: [string, string][] = [
      ["A five-star bag.", "a rating"],
      ["Four and a half stars.", "a rating"],
      ["It has 120 customer reviews.", "a rating"],
      ["Over 500+ reviews.", "a rating"],
      ["Rated four out of five.", "a rating"],
      ["Buyers give it 4 out of five.", "a rating"],
      ["4.7★ from buyers.", "a rating"],
      ["It's highly rated.", "a rating"],
      ["It's rated 4.6 of 5.", "a rating"],
      ["4.6 of 5 stars.", "a rating"],
      ["A rating of 4.6.", "a rating"],
      ["Scores 4 of 5 with buyers.", "a rating"],
      ["Under the 200-dollar mark.", "a price"],
      ["About 129$ now.", "a price"],
      ["It's 20% off.", "a sale claim"],
      ["It's on sale.", "a sale claim"],
      ["It's in stock.", "a stock claim"],
      ["It ships tomorrow.", "a stock claim"],
      ["It ships today.", "a stock claim"],
      ["A bestseller for the shop.", '"bestseller"'],
      ["Their bestselling tote.", '"bestseller"'],
      ["There are only a few left.", '"only X left"'],
      ["Only 2 black ones left.", '"only X left"'],
      ["It's going fast.", '"selling fast"'],
      ["Their most popular pack.", '"most popular"'],
      ["My top choice.", '"top pick"'],
      ["Buy it today.", '"buy it today"'],
      ["Stock is running low.", '"running low"'],
      ["This one works best.", '"best"'],
      ["It's the best for commuting.", '"best"'],
      ["The No. 1 pack for travel.", '"#1"'],
    ];
    for (const [text, label] of cases) {
      expect(findBannedText(text), text).toContain(label);
    }
  });

  it("blocks a bare number that is a known product's price, unless the buyer gave it", () => {
    const knownPrices = createKnownPrices([
      makeProduct({ id: "p-1" }), // $129
      makeProduct({
        id: "p-2",
        priceRange: { min: { amount: 8999, currency: "USD" }, max: { amount: 8999, currency: "USD" } },
      }),
    ]);
    for (const text of ["This one is 129.", "That one is 89.99.", "Around 89 for the smaller one."]) {
      expect(findBannedText(text, { knownPrices }), text).toEqual(["a price"]);
      expect(checkReplyText(text, { knownPrices }).facts, text).toEqual(["a price"]);
    }
    // A number that is not a known price, or that the buyer gave, passes.
    expect(findBannedText("It holds 70 things.", { knownPrices })).toEqual([]);
    expect(findBannedText("Under your 129 limit.", { knownPrices, allowedAmounts: [129] })).toEqual([]);
    // A number with a unit is not a price.
    for (const text of ["A 129 L duffel", "Fits 129-inch poles", "Sizes 120-129 cm fit"]) {
      expect(findBannedText(text, { knownPrices }), text).toEqual([]);
    }
  });

  it("keeps text after a missing space, and a weight before a full stop, when stripping links", () => {
    expect(stripLinks("Weighs 1.2kg.Store it flat.")).toBe("Weighs 1.2kg.Store it flat.");
    expect(stripLinks("Fits a laptop.Co-branded straps.")).toBe("Fits a laptop.Co-branded straps.");
    expect(stripLinks("Care at shop.com/care and hello@trailgoods.shop.")).not.toMatch(/shop\.com|trailgoods\.shop/);
  });
});

/** The fourth review's examples. */
describe("fourth review", () => {
  const knownPrices = createKnownPrices([makeProduct({ id: "p-1" })]); // $129

  it("does not read a buyer's measure as an amount, and reads 2k as 2000", () => {
    expect(buyerAmountsIn("A 16 inch laptop, 30 L, 2 kg, 3 days, 4 pockets, for 200")).toEqual([200]);
    expect(buyerAmountsIn("A 16in screen, a 16-in laptop, a 16 in laptop, 2x the room")).toEqual([]);
    expect(buyerAmountsIn("Under 2k, or 1.5k at best")).toEqual([2000, 1500]);
    expect(amountsIn("Under $2k")).toEqual([2000]);
    // The buyer's "2k" lets Pica say $2,000.
    expect(findBannedText("I'll stay under $2,000.", { allowedAmounts: buyerAmountsIn("under 2k") })).toEqual([]);
    // Known limit: worded amounts are not read.
    expect(buyerAmountsIn("about two hundred")).toEqual([]);
  });

  it("blocks delivery claims in replies and tool text", () => {
    for (const text of [
      "It ships in 2 days.",
      "It arrives by Friday.",
      "Delivery takes 3-5 business days.",
      "It delivers within a week.",
      "Next-day delivery on this one.",
      "Free shipping on this one.",
      "It comes with free returns.",
      "It ships free.",
    ]) {
      expect(findBannedText(text), text).toEqual(["a delivery claim"]);
      expect(checkReplyText(text).facts, text).toEqual(["a delivery claim"]);
    }
    for (const text of [
      "I can't see whether it ships in 2 days.",
      "It arrives in a dust bag.",
      "It fits 3 days of clothes.",
      "Shipping times are on the merchant's page.",
    ]) {
      expect(findBannedText(text), text).toEqual([]);
    }
  });

  it("lets an excuse word off only in the same clause, a few words before", () => {
    for (const text of [
      "If you want light, it's in stock.",
      // "If" is more than four words before the claim.
      "If the strap and the sleeve and the lining all matter to you it is in stock.",
      "I'm not sure about the colours, but it's in stock.",
      "Whatever you pick, it's on sale.",
      "If you ask me, it's the best bag.",
      "Whether you commute or travel, this is the best bag.",
      "Isn't it the best bag?",
      "Is it best for travel?",
    ]) {
      expect(findBannedText(text), text).not.toEqual([]);
    }
    for (const text of [
      "I can't see whether it's in stock.",
      "I'm not sure if it's on sale.",
      "Which one works best for you?",
      "What's best for rain depends on the zips.",
    ]) {
      expect(findBannedText(text), text).toEqual([]);
    }
  });

  it("counts in, x and pieces as a unit only when joined to the number or, for in, before a noun", () => {
    for (const text of [
      "Pick the 129 in navy.",
      "It's 129 x 2 for the pair.",
      "Sizes 120-129 fit.",
      "They run 99/129.",
      "It's 120–129.",
    ]) {
      expect(findBannedText(text, { knownPrices }), text).toEqual(["a price"]);
    }
    for (const text of ["Fits a 129in frame.", "Fits a 129-in frame.", "Fits a 129 in laptop.", "A 129-piece kit.", "129x zoom."]) {
      expect(findBannedText(text, { knownPrices }), text).toEqual([]);
    }
  });

  it("reads a price with cents as its rounded dollar too", () => {
    const cents = createKnownPrices([
      makeProduct({ id: "p-9", priceRange: { min: { amount: 12999, currency: "USD" }, max: { amount: 12999, currency: "USD" } } }),
    ]);
    for (const text of ["About 130 for that one.", "About 129 for that one.", "It is 129.99."]) {
      expect(findBannedText(text, { knownPrices: cents }), text).toEqual(["a price"]);
    }
  });

  it("blocks a decimal score out of 5 with no rating word", () => {
    for (const text of ["Buyers give it 4.6 of 5.", "It sits at 4.6 out of 5."]) {
      expect(findBannedText(text), text).toEqual(["a rating"]);
    }
    expect(findBannedText("It has 2 of 5 pockets padded.")).toEqual([]);
  });

  it("passes a sales word right after a negation, and narrow scarcity and top pick", () => {
    for (const text of [
      "No need to buy today.",
      "It's not a perfect fit for a 17 inch laptop.",
      "You don't have to buy now.",
      "No need to hurry.",
      "It has a top pick-up handle.",
      "Only one question left before I search.",
      "That's not the best bag for rain.",
    ]) {
      expect(findBannedText(text), text).toEqual([]);
    }
    for (const text of [
      "Buy it today.",
      "Don't wait, buy now.",
      "There's no doubt it's the best bag.",
      "Without question the best bag here.",
      "No other bag is the best bag like this.",
      "Only 3 left.",
      "Only 2 black ones left.",
      "Only one size left.",
      "It's our top pick.",
    ]) {
      expect(findPressure(text), text).not.toEqual([]);
    }
  });
});

describe("after-round-4 patch", () => {
  it("lets which and what excuse a best claim, but never a catalog fact", () => {
    for (const text of [
      "I'd go with the Aer, which is in stock.",
      "The rolltop, which is on sale, has a padded sleeve.",
      "The second one, which is 20% off, is lighter.",
      "The Aer pack which ships in 2 days fits your laptop.",
      "The one which comes with free shipping is the Aer.",
      "Here's what is in stock.",
    ]) {
      expect(checkReplyText(text).facts, text).not.toEqual([]);
    }
    for (const text of [
      "Which one works best for you?",
      "What's best for rain depends on the zips.",
      "I can't see whether it's in stock.",
      "If it's sold out in black, the navy is the same bag.",
    ]) {
      expect(findBannedText(text), text).toEqual([]);
    }
  });

  it("ends a sentence at no unless a number follows, and at max or min only before a capital", () => {
    for (const text of [
      "The listing says no. It's the best bag for you.",
      "The answer is no. Buy it today.",
      "I would say no. Hurry.",
    ]) {
      expect(findPressure(text), text).not.toEqual([]);
    }
    expect(splitSentences("Weight is 2 kg max. It's the best bag here.")).toEqual([
      "Weight is 2 kg max.",
      "It's the best bag here.",
    ]);
    expect(splitSentences("Fits max. 17 inch laptops. Holds no. 2 pencils.")).toEqual([
      "Fits max. 17 inch laptops.",
      "Holds no. 2 pencils.",
    ]);
    expect(splitSentences("Order 2 bags min. Then it ships. The min. order is 2 bags. Use the max. load.")).toEqual([
      "Order 2 bags min.",
      "Then it ships.",
      "The min. order is 2 bags.",
      "Use the max. load.",
    ]);
    expect(findPressure("Order 2 bags min. Buy it today.")).not.toEqual([]);
  });

  it("folds full-width forms and drops zero-width characters before the rules run", () => {
    const zw = String.fromCharCode(0x200b);
    expect(findBannedText("It's ＄１２９.")).toEqual(["a price"]);
    expect(checkReplyText("It's ＄１２９.").facts).toEqual(["a price"]);
    expect(findBannedText(`It's the be${zw}st bag.`)).toEqual(['"best"']);
    expect(checkReplyText(`It's in st${zw}ock.`).facts).toEqual(["a stock claim"]);
    expect(findBannedText("Rated ４.６ out of ５.")).toEqual(["a rating"]);
  });

  it("reads a full-width inch mark as a measure, not a price", () => {
    const known = createKnownPrices([
      makeProduct({
        id: "p-15",
        priceRange: { min: { amount: 1500, currency: "USD" }, max: { amount: 1500, currency: "USD" } },
      }),
    ]);
    expect(checkReplyText("It fits a 15″ laptop.", { knownPrices: known }).facts).toEqual([]);
    expect(checkReplyText("It fits a 15 laptop.", { knownPrices: known }).facts).toEqual(["a price"]);
  });

  it("normalises text in findPressure too", () => {
    const zw = String.fromCharCode(0x200b);
    expect(findPressure(`It's the be${zw}st bag.`)).toEqual(['"best"']);
  });

  it("says the canvas changed since the shortlist without saying who changed it", () => {
    const prompt = buildInstructions({
      session: makeSession({ shortlistProductIds: ["p-1"], canvasChangedSinceShortlist: true }),
      questionsAsked: 1,
      turnRead: NO_TURN_READ,
    });
    expect(prompt).toContain("The canvas has changed since the last shortlist.");
    expect(prompt).toMatch(/call \w+ with a fresh set/);
    expect(prompt).not.toMatch(/buyer (?:changed|edited) the canvas/i);
  });
});
