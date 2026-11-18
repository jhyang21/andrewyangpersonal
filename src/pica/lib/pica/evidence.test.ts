import { describe, expect, it } from "vitest";
import { COMPARE_QUOTE_MAX_CHARS } from "./constants";
import { findQuote } from "./evidence";
import { makeProduct } from "./test-helpers";

const product = makeProduct({
  id: "p-1",
  descriptionText:
    "Weighs 1.6 kg empty. The shell is not waterproof, so use the rain cover. Fits a 16-inch laptop. Non water resistant zips.",
  summarized: {
    sellingPoints: ["Light for daily commutes."],
    features: ["Waterproof", "Padded laptop sleeve"],
    specs: ["Material: Nylon", "Waterproof: No"],
  },
});

const merchant = (descriptionText: string) => makeProduct({ id: "p-m", descriptionText });

describe("findQuote", () => {
  it("keeps numbers whole, so a part of a decimal doesn't match", () => {
    expect(findQuote(product, "merchant", "6 kg empty")).toBeNull();
    expect(findQuote(product, "merchant", "weighs 1.6 kg")).toBe("Weighs 1.6 kg empty.");
  });

  it("rejects a match right after a negation the quote leaves out", () => {
    expect(findQuote(product, "merchant", "waterproof, so use the rain cover")).toBeNull();
    expect(findQuote(product, "merchant", "water resistant zips")).toBeNull();
    // With the negation in the quote, it stands.
    expect(findQuote(product, "merchant", "the shell is not waterproof")).toBe(
      "The shell is not waterproof, so use the rain cover.",
    );
  });

  it("needs 3 words, or the whole sentence when it is shorter", () => {
    expect(findQuote(product, "merchant", "rain cover")).toBeNull();
    expect(findQuote(product, "catalog_summary", "laptop sleeve")).toBeNull();
    expect(findQuote(product, "catalog_summary", "waterproof")).toBe("Waterproof");
  });

  it("matches inside one sentence only", () => {
    expect(findQuote(product, "merchant", "rain cover fits a 16-inch laptop")).toBeNull();
    expect(findQuote(product, "catalog_summary", "Padded laptop sleeve Material Nylon")).toBeNull();
  });

  it("returns the source's own words, not the model's copy", () => {
    expect(findQuote(product, "merchant", "FITS A 16 INCH   laptop")).toBe("Fits a 16-inch laptop.");
    expect(findQuote(product, "catalog_summary", "light for daily commutes")).toBe("Light for daily commutes.");
  });
});

describe("findQuote: third review", () => {
  it("returns the whole sentence, so a later clause or answer is in view", () => {
    // The quote leaves out "so use the rain cover"; the buyer still sees it.
    expect(findQuote(product, "merchant", "so use the rain cover")).toBe(
      "The shell is not waterproof, so use the rain cover.",
    );
    // A question and its answer stay together.
    const qa = merchant("Waterproof? No. Fits a 15 inch laptop.");
    expect(findQuote(qa, "merchant", "Waterproof? No")).toBe("Waterproof? No.");
    expect(findQuote(qa, "merchant", "waterproof")).toBeNull();
    // A "label: value" line comes whole, value and all.
    expect(findQuote(product, "catalog_summary", "Waterproof: No")).toBe("Waterproof: No");
  });

  it("cuts a long sentence at a word, around the match, with an ellipsis", () => {
    const long = merchant(`The main pocket ${"holds a lot of gear for long trips and ".repeat(8)}fits a 16 inch laptop with room to spare.`);
    const quote = findQuote(long, "merchant", "fits a 16 inch laptop");
    expect(quote).not.toBeNull();
    expect(quote!.length).toBeLessThanOrEqual(COMPARE_QUOTE_MAX_CHARS);
    expect(quote).toContain("fits a 16 inch laptop");
    expect(quote!.startsWith("…")).toBe(true);
    expect(quote!.endsWith("room to spare.")).toBe(true);
  });

  it("rejects a number at either end that is part of a larger figure", () => {
    const sizes = merchant("Fits a 1/2 inch hose clip. Fits 13-16 inch laptops.");
    expect(findQuote(sizes, "merchant", "2 inch hose clip")).toBeNull();
    expect(findQuote(sizes, "merchant", "16 inch laptops")).toBeNull();
    expect(findQuote(sizes, "merchant", "Fits 13")).toBeNull();
    expect(findQuote(sizes, "merchant", "fits 13-16 inch laptops")).toBe("Fits 13-16 inch laptops.");
  });

  it("can't cross a removed link, and keeps a weight before a full stop", () => {
    const linked = merchant("See https://shop.example.com/care for care tips and repairs. Weighs 1.2kg.Store it flat.");
    expect(findQuote(linked, "merchant", "See for care tips")).toBeNull();
    expect(findQuote(linked, "merchant", "for care tips and repairs")).toBe("for care tips and repairs.");
    // A full stop with no space after it does not end the sentence.
    expect(findQuote(linked, "merchant", "weighs 1.2kg store")).toBe("Weighs 1.2kg.Store it flat.");
  });

  it("shows no quote whose sentence is a sales claim, a rating, a price or a stock claim", () => {
    const puffy = merchant(
      "The best bag on the market for commuters. Rated 4.8 by 2,000 buyers who carry laptops. In stock and ready to ship today. Hurry, only 3 left in black canvas. Yours for $129 with a laptop sleeve.",
    );
    for (const quote of [
      "bag on the market for commuters",
      "buyers who carry laptops",
      "ready to ship today",
      "left in black canvas",
      "with a laptop sleeve",
    ]) {
      expect(findQuote(puffy, "merchant", quote), quote).toBeNull();
    }
  });

  it("rejects a match after any negation earlier in the same clause", () => {
    const negated = merchant(
      "Lacks a padded laptop sleeve. Free of PVC and other plastics. No longer includes a rain cover. Everything except the rain cover is waterproof. It rarely needs a wash cycle. Not heavy but roomy enough for a week.",
    );
    for (const quote of [
      "a padded laptop sleeve",
      "PVC and other plastics",
      "includes a rain cover",
      "the rain cover is waterproof",
      "needs a wash cycle",
    ]) {
      expect(findQuote(negated, "merchant", quote), quote).toBeNull();
    }
    // "but" starts a new clause; the whole sentence still shows the "Not".
    expect(findQuote(negated, "merchant", "roomy enough for a week")).toBe("Not heavy but roomy enough for a week.");
  });
});

describe("findQuote: fourth review", () => {
  it("does not end a sentence at a short abbreviation or at a full stop with no space after it", () => {
    const p = merchant("Holds approx. 2 kg of gear on the frame. Fits e.g. a 15 inch laptop in the sleeve.");
    expect(findQuote(p, "merchant", "2 kg of gear")).toBe("Holds approx. 2 kg of gear on the frame.");
    expect(findQuote(p, "merchant", "a 15 inch laptop")).toBe("Fits e.g. a 15 inch laptop in the sleeve.");
    // So a negation before the abbreviation still counts.
    const negated = merchant("Not incl. the padded rain cover. Does not fit max. 17 inch laptops. Comes with no strap.Padded laptop sleeve inside.");
    for (const quote of ["the padded rain cover", "17 inch laptops", "padded laptop sleeve inside"]) {
      expect(findQuote(negated, "merchant", quote), quote).toBeNull();
    }
  });

  it("refuses a quote under a negated heading", () => {
    const listed = merchant("Does not include:\nRain cover\nPadded laptop sleeve\nIncludes:\nBottle pocket with zip");
    expect(findQuote(listed, "merchant", "padded laptop sleeve")).toBeNull();
    expect(findQuote(listed, "merchant", "rain cover")).toBeNull();
    expect(findQuote(listed, "merchant", "bottle pocket with zip")).toBe("Bottle pocket with zip");
    const inline = merchant("Not suitable for: rain, snow or wet salt roads");
    expect(findQuote(inline, "merchant", "snow or wet salt roads")).toBeNull();
  });

  it("reads negations written without the apostrophe", () => {
    const p = merchant("It doesnt have a padded laptop sleeve. We dont add a rain cover. It wont fit a tripod. You cant wash it hot.");
    for (const quote of ["have a padded laptop sleeve", "add a rain cover", "fit a tripod", "wash it hot"]) {
      expect(findQuote(p, "merchant", quote), quote).toBeNull();
    }
  });

  it("shows no quote whose sentence holds the product's price as a bare number, or a delivery claim", () => {
    const p = merchant(
      "Only 129 for the full commuter kit. The padded sleeve fits a laptop and ships in 2 days. Free shipping on the roll-top model. The bottle pocket holds a large flask.",
    );
    for (const quote of ["for the full commuter kit", "padded sleeve fits a laptop", "on the roll-top model"]) {
      expect(findQuote(p, "merchant", quote), quote).toBeNull();
    }
    expect(findQuote(p, "merchant", "bottle pocket holds")).toBe("The bottle pocket holds a large flask.");
  });

  it("refuses a cut quote when the part cut off holds a condition or a negation", () => {
    const head =
      "The padded laptop sleeve keeps a 16 inch laptop safe on the daily commute, and the lining resists scuffs from keys and chargers, and the frame sheet holds its shape through years of hard travel";
    const conditional = merchant(`${head} and daily use in the city, unless you overpack the main compartment.`);
    expect(findQuote(conditional, "merchant", "padded laptop sleeve keeps")).toBeNull();
    const negated = merchant(`${head} and daily use in the city, though it is not waterproof in heavy rain.`);
    expect(findQuote(negated, "merchant", "padded laptop sleeve keeps")).toBeNull();
    const plain = merchant(`${head} and daily use in the city, with a grab handle on top for short carries.`);
    const quote = findQuote(plain, "merchant", "padded laptop sleeve keeps");
    expect(quote).toMatch(/^The padded laptop sleeve keeps .*…$/);
    expect(quote!.length).toBeLessThanOrEqual(COMPARE_QUOTE_MAX_CHARS);
  });
});

describe("findQuote: after-round-4 patch", () => {
  it("ends a sentence at no unless a number follows, and at max only before a capital", () => {
    const p = merchant("Waterproof? The answer is no. Padded laptop sleeve inside. Weight is 2 kg max. Bottle pocket on the side.");
    expect(findQuote(p, "merchant", "padded laptop sleeve inside")).toBe("Padded laptop sleeve inside.");
    expect(findQuote(p, "merchant", "bottle pocket on")).toBe("Bottle pocket on the side.");
  });

  it("refuses a quote cut at the head when the part cut off holds a negation", () => {
    const sentence =
      "This bag is not recommended for checked luggage, heavy camera gear, wet climbing ropes, sharp tent poles, glass bottles, loose liquids, large tripods, kayak paddles, ski boots, or daily use as a carry-on bag for flights.";
    expect(sentence.length).toBeGreaterThan(COMPARE_QUOTE_MAX_CHARS);
    expect(findQuote(merchant(sentence), "merchant", "daily use as a carry-on bag for flights")).toBeNull();
    // The same sentence with no negation is cut and shown.
    const plain = sentence.replace("is not recommended", "is made");
    expect(findQuote(merchant(plain), "merchant", "daily use as a carry-on bag for flights")).toMatch(
      /^….*daily use as a carry-on bag for flights\.$/,
    );
  });

  it("walks past a label colon and full-stop list lines to the heading", () => {
    const labelled = merchant("Not included:\nStrap: padded leather shoulder strap");
    expect(findQuote(labelled, "merchant", "padded leather shoulder strap")).toBeNull();
    const timed = merchant("Excludes:\nPickup at 9:00 from the city depot");
    expect(findQuote(timed, "merchant", "from the city depot")).toBeNull();
    const listed = merchant("Does not include:\nA rain cover.\nA shoulder strap.\nA padded laptop sleeve.");
    for (const quote of ["a rain cover", "a shoulder strap", "a padded laptop sleeve"]) {
      expect(findQuote(listed, "merchant", quote), quote).toBeNull();
    }
    // A later heading line ends the list.
    const next = merchant("Does not include:\nA rain cover.\nIncludes:\nThe padded laptop sleeve fits 16 inch.");
    expect(findQuote(next, "merchant", "padded laptop sleeve fits")).toBe("The padded laptop sleeve fits 16 inch.");
    // So does the 20-line reach.
    const filler = Array.from({ length: 20 }, (_, k) => `Item ${k + 1}`).join("\n");
    const far = merchant(`Does not include:\n${filler}\nThe padded laptop sleeve fits 16 inch.`);
    expect(findQuote(far, "merchant", "padded laptop sleeve fits")).toBe("The padded laptop sleeve fits 16 inch.");
  });
});

describe("findQuote: second patch", () => {
  it("keeps max. and min. inside a sentence before a lower-case word", () => {
    for (const [text, quote] of [
      ["Does not fit laptops over the max. sleeve size of 16 inch.", "sleeve size of 16 inch"],
      ["Not rated for the max. load of a full camera kit.", "load of a full camera kit"],
      ["There is no min. order for spare straps.", "order for spare straps"],
    ]) {
      expect(findQuote(merchant(text), "merchant", quote), quote).toBeNull();
    }
    const whole = "Carry-on approved only up to max. cabin size on most airlines.";
    expect(findQuote(merchant(whole), "merchant", "cabin size on most airlines")).toBe(whole);
  });

  it("skips blank lines and link lines on the way up to a heading", () => {
    expect(findQuote(merchant("Not included:\n\nRain cover\nShoulder strap"), "merchant", "rain cover")).toBeNull();
    expect(
      findQuote(merchant("Not included:\nwww.shop.com/extras\nRain cover\nShoulder strap"), "merchant", "rain cover"),
    ).toBeNull();
  });
});
