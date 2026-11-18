import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CatalogImage } from "@/pica/lib/types";
import { Price, formatMoney, otherVersionsText } from "./Price";
import { ProductImage } from "./ProductImage";
import { ProductSummary } from "./ProductSummary";
import { Rating } from "./Rating";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const usd = (amount: number) => ({ amount, currency: "USD" });
const PHOTO: CatalogImage = { url: "https://cdn.example.com/a.jpg", alt: "Merchant note", width: 800, height: 800 };

describe("formatMoney", () => {
  it("drops cents on whole amounts and keeps them otherwise", () => {
    expect(formatMoney(usd(12000))).toBe("$120");
    expect(formatMoney(usd(11999))).toBe("$119.99");
    expect(formatMoney({ amount: 2400000, currency: "JPY" })).toBe("¥2,400,000");
  });
});

describe("Price", () => {
  it("shows the price plain", () => {
    const out = html(<Price price={usd(16800)} />);
    expect(out).toContain(">$168</span>");
    expect(out).toContain("text-body-lg");
    expect(html(<Price price={usd(16800)} size="lg" />)).toContain("text-heading");
  });

  it("has no struck-through form and takes no list price", () => {
    const out = html(<Price price={usd(16800)} max={usd(19800)} otherVersions={{ min: usd(16800), max: usd(22800) }} />);
    expect(out).not.toMatch(/<s[\s>]|<del|line-through/);
    // The prop does not exist, so a caller cannot ask for a sale mark.
    // @ts-expect-error listPrice is not a Price prop
    html(<Price price={usd(16800)} listPrice={usd(19800)} />);
    const source = readFileSync("src/pica/components/kit/Price.tsx", "utf8");
    expect(source).not.toMatch(/line-through|<s>|listPrice/);
  });

  it("reads a range as from and to", () => {
    const out = html(<Price price={usd(8000)} max={usd(12000)} />);
    expect(out).toContain('<span class="sr-only">From </span>$80<span aria-hidden="true">–</span>');
    expect(out).toContain("$120");
  });

  it("adds the other-versions line only when versions cost something else", () => {
    expect(otherVersionsText(usd(16800), { min: usd(16800), max: usd(16800) })).toBeNull();
    expect(otherVersionsText(usd(16800), { min: usd(16800), max: usd(22800) })).toBe("Other versions cost $168 to $228");
    expect(otherVersionsText(usd(16800), { min: usd(19800), max: usd(19800) })).toBe("Other versions cost $198");
    expect(otherVersionsText(usd(16800), { min: { amount: 1, currency: "EUR" }, max: usd(1) })).toBeNull();
    const out = html(<Price price={usd(16800)} otherVersions={{ min: usd(16800), max: usd(22800) }} />);
    expect(out).toMatch(/<span class="text-body text-ink-soft">Other versions cost \$168 to \$228<\/span>/);
  });
});

describe("Rating", () => {
  it("renders nothing with no rating or no reviews", () => {
    expect(html(<Rating rating={undefined} />)).toBe("");
    expect(html(<Rating rating={{ value: 4, count: 0, scaleMax: 5 }} />)).toBe("");
  });
  it("shows value and count, and reads in full", () => {
    const out = html(<Rating rating={{ value: 4.62, count: 212, scaleMax: 5 }} />);
    expect(out).toContain("4.6");
    expect(out).toContain('<span class="text-ink-soft">(212)</span>');
    expect(out).toContain("Rated 4.6 out of 5, 212 reviews");
  });
  it("shows other scales and notes few reviews when asked", () => {
    const out = html(<Rating rating={{ value: 8.2, count: 1, scaleMax: 10 }} noteFewReviews />);
    expect(out).toContain(" / 10");
    expect(out).toContain("1 review<");
    expect(out).toContain("Few reviews so far");
    expect(html(<Rating rating={{ value: 4, count: 20, scaleMax: 5 }} noteFewReviews />)).not.toContain("Few reviews");
  });
});

describe("ProductImage", () => {
  it("shows a plain <img> with the caller's name as alt text", () => {
    const out = html(<ProductImage image={PHOTO} alt="Slim Commuter Backpack" eager />);
    expect(out).toContain('<img src="https://cdn.example.com/a.jpg" alt="Slim Commuter Backpack"');
    expect(out).toContain('loading="eager"');
    expect(out).toContain('referrerPolicy="no-referrer"');
  });
  it("is decorative when no text is given", () => {
    const out = html(<ProductImage image={{ ...PHOTO, alt: "" }} />);
    expect(out).toContain('alt="" role="presentation"');
  });
  it("falls back to a labelled placeholder with no image", () => {
    const out = html(<ProductImage image={null} alt="Canvas tote" />);
    expect(out).toContain('role="img" aria-label="Canvas tote, no photo"');
    expect(out).toContain("lucide-image-off");
    expect(out).not.toContain("<img");
  });
  it("a decorative placeholder is hidden from screen readers, not read as No photo", () => {
    const out = html(<ProductImage image={null} alt="" />);
    expect(out).toMatch(/^<div aria-hidden="true"/);
    expect(out).not.toContain("role=");
    expect(out).not.toContain("aria-label");
  });
});

describe("ProductSummary", () => {
  it("puts thumbnail, name, merchant and price in one row; the thumbnail is decorative", () => {
    const out = html(<ProductSummary image={PHOTO} name="Slim Commuter Backpack" merchant="Example Goods" price={usd(16800)} />);
    expect(out).toContain('alt="" role="presentation"');
    expect(out).toContain(">Slim Commuter Backpack</p>");
    expect(out).toMatch(/<p class="[^"]*text-ink-soft">Example Goods<\/p>/);
    expect(out).toContain(">$168</span>");
    expect(out).not.toContain("truncate");
    // The price sits under the merchant in narrow spaces and at the row's end otherwise; one shows at a time.
    expect(out).toContain('<span class="@xs:hidden">');
    expect(out).toContain('<span class="hidden shrink-0 text-right @xs:block">');
  });
  it("with no photo, the thumbnail stays silent", () => {
    const out = html(<ProductSummary image={null} name="Canvas tote" merchant="Example Goods" price={usd(4200)} />);
    expect(out).not.toContain("No photo");
    expect(out).not.toContain('role="img"');
    expect(out).toContain('<div aria-hidden="true"');
    expect(out).toContain("lucide-image-off");
  });
});
