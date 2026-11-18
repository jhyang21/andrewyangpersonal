import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seedDecision } from "@/app/projects/pica/kit/seed/fixture";
import type { CatalogProduct, DecisionSession } from "@/pica/lib/types";
import { DecideView, NoOptionView } from "./DecideView";
import type { DecideModel } from "./useDecide";

const noop = () => undefined;
const AT = Date.UTC(2026, 10, 17, 14, 0);
const session = seedDecision(AT);
const commuterId = "gid://shopify/p/seed-commuter";
const commuter: CatalogProduct = session.products[commuterId];
const usd = (dollars: number) => ({ amount: dollars * 100, currency: "USD" });

/** A Decide model as the hook would give it, with the product loaded unless told otherwise. */
function model(over: Partial<DecideModel> = {}): DecideModel {
  return {
    load: { state: "ready", product: commuter },
    product: commuter,
    variant: commuter.variants[0],
    stock: "in_stock",
    merchant: commuter.seller.name,
    choices: [],
    choiceProblem: null,
    rechecked: false,
    rechecking: false,
    quoteRanOut: false,
    checkout: { state: "idle" },
    busy: false,
    choosing: false,
    canStart: true,
    step: "start",
    costs: undefined,
    quantity: 1,
    choose: noop,
    startCheckout: noop,
    pay: noop,
    retryLoad: noop,
    save: noop,
    decline: noop,
    ...over,
  } as DecideModel;
}

const view = (decide: DecideModel, on: DecisionSession = session) =>
  renderToStaticMarkup(<DecideView session={on} productId={commuterId} decide={decide} />);

const count = (out: string, text: string) => out.split(text).length - 1;

/** The opening tag of the last button or link before `label`. */
function buttonTag(out: string, label: string): string {
  const before = out.slice(0, out.indexOf(label));
  const open = Math.max(before.lastIndexOf("<button"), before.lastIndexOf("<a "));
  return before.slice(open, before.indexOf(">", open) + 1);
}

const classOf = (out: string, label: string) => buttonTag(out, label).match(/class="([^"]*)"/)?.[1] ?? "";

describe("DecideView", () => {
  it("has one h1, the decision's title, and the product name as an h2", () => {
    const out = view(model());
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(new RegExp(`<h1[^>]*>${session.title}</h1>`));
    expect(out).toMatch(/<h2[^>]*>Commuter Pack 24L<\/h2>/);
    expect(out).toContain("Back to your options");
  });

  it("puts the one purple button first, then Save and End", () => {
    const out = view(model());
    const start = out.indexOf("Continue to checkout");
    const save = out.indexOf("Save for later");
    const end = out.indexOf("End without buying");
    expect(start).toBeGreaterThan(0);
    expect(save).toBeGreaterThan(start);
    expect(end).toBeGreaterThan(save);
    expect(out).not.toContain("Not buying");
    expect(out).toContain("Nothing is bought until you pay there.");
    expect(out).toContain("Shipping and tax show at the next step.");
  });

  it("gives the three buttons the same size: full width, the same height", () => {
    const out = view(model());
    const shapes = ["Continue to checkout", "Save for later", "End without buying"].map((label) => {
      const cls = classOf(out, label);
      return { fullWidth: /\bw-full\b/.test(cls), height: cls.match(/\bmin-h-\d+\b/)?.[0] };
    });
    expect(shapes).toEqual([
      { fullWidth: true, height: "min-h-12" },
      { fullWidth: true, height: "min-h-12" },
      { fullWidth: true, height: "min-h-12" },
    ]);
  });

  it("sets the price at the heading size", () => {
    expect(view(model())).toMatch(/class="[^"]*\btext-heading\b[^"]*"[^>]*>\$/);
  });

  it("keeps one Continue button from loading to loaded, busy but not disabled while it loads", () => {
    const loading = view(model({ load: { state: "loading" }, product: undefined, variant: undefined, merchant: "", canStart: false }));
    expect(count(loading, "Continue to checkout")).toBe(1);
    const tag = buttonTag(loading, "Continue to checkout");
    expect(tag).toContain('aria-busy="true"');
    expect(tag).not.toMatch(/\sdisabled=""/);
  });

  it("keeps Save and End while the product loads or fails to load", () => {
    const loading = view(model({ load: { state: "loading" }, product: undefined, variant: undefined, merchant: "" }));
    expect(loading).toContain("Save for later");
    expect(loading).toContain("End without buying");
    expect(loading).toContain('aria-busy="true"');

    const failed = view(
      model({
        load: { state: "failed", error: { code: "catalog_unavailable", message: "The catalog is down." }, status: 503 },
        product: undefined,
        variant: undefined,
        merchant: "",
      }),
    );
    expect(failed).toContain("The catalog is down.");
    expect(failed).toContain("Save for later");
    expect(failed).toContain("End without buying");
    expect(failed).not.toContain("Continue to checkout");
    expect(failed).toContain("Try again");

    const gone = view(
      model({
        load: { state: "failed", error: { code: "not_found", message: "That product is gone." }, status: 404 },
        product: undefined,
        variant: undefined,
        merchant: "",
      }),
    );
    expect(gone).toContain("That product is gone.");
    expect(gone).not.toContain("Try again");
    expect(gone).toContain("Back to your options");
  });

  it("shows an ended decision's product and one link to Done, and nothing to buy, save or end", () => {
    for (const status of ["declined", "bought"] as const) {
      const ended: DecisionSession = { ...session, decision: { status, productId: commuterId } };
      const out = view(model(), ended);
      expect(out).toMatch(/<h2[^>]*>Commuter Pack 24L<\/h2>/);
      expect(out).toContain(`href="/projects/pica/d/${session.id}/done"`);
      expect(out).toContain("See how this ended");
      expect(out).not.toContain("Continue to checkout");
      expect(out).not.toContain("Save for later");
      expect(out).not.toContain("End without buying");
    }
  });

  it("shows the tradeoff from the shortlist, both sides alike, and the evidence button", () => {
    const entry = session.shortlist!.entries.find((e) => e.productId === commuterId)!;
    const out = view(model());
    expect(out).toContain("Why it fits you");
    expect(out).toContain("Why you might not want it");
    expect(out).toContain(entry.whyNot[0].replace(/'/g, "&#x27;"));
    expect(out).toContain("See the evidence");
  });

  it("points the evidence button at the evidence sheet, which keeps that id while closed", () => {
    const out = view(model());
    expect(out).toMatch(/<button[^>]*aria-controls="evidence-sheet"[^>]*>(?:(?!<\/button>)[\s\S])*See the evidence/);
    expect(out).toContain('<dialog id="evidence-sheet"');
  });

  it("keeps both sides of the tradeoff when Pica wrote only one", () => {
    const noDrawback: DecisionSession = {
      ...session,
      shortlist: {
        ...session.shortlist!,
        entries: session.shortlist!.entries.map((e) => (e.productId === commuterId ? { ...e, whyNot: [] } : e)),
      },
    };
    const out = view(model(), noDrawback);
    expect(out).toContain("Why it fits you");
    expect(out).toContain("Why you might not want it");
    expect(out).toContain("Pica listed no drawback.");
    expect(count(out, "<dt")).toBe(2);
  });

  it("shows the costs as the merchant sent them, and the pay button", () => {
    const out = view(
      model({
        step: "pay",
        checkout: { state: "review" } as DecideModel["checkout"],
        costs: { totals: { subtotal: usd(129), tax: usd(10), total: usd(139) }, expiresAt: "2026-11-17T15:40:00Z" },
      }),
    );
    expect(out).toContain(`Go to ${commuter.seller.name} to pay`);
    expect(out).toContain("Subtotal");
    expect(out).toContain(`Shown at ${commuter.seller.name}`);
    expect(out).toContain("$139");
    expect(out).toContain("These costs hold until");
    expect(out).not.toContain("Shipping and tax show at the next step.");
  });

  it("says when the quote ran out, and shows the failed checkout's own words", () => {
    const out = view(
      model({
        quoteRanOut: true,
        checkout: { state: "failed", error: { code: "checkout_unavailable", message: "The merchant said no." } },
      }),
    );
    expect(out).toContain("ran out, so they were cleared");
    expect(out).toContain("The merchant said no.");
  });

  it("marks a sold-out choice and keeps it off", () => {
    const out = view(
      model({
        choices: [
          {
            name: "Color",
            current: "Black",
            fixed: false,
            values: [
              { label: "Black", soldOut: false, selected: true },
              { label: "Olive", soldOut: true, selected: false },
            ],
          },
        ],
      }),
    );
    expect(out).toContain("<legend");
    expect(buttonTag(out, "Olive, sold out")).toMatch(/\sdisabled=""/);
    expect(buttonTag(out, ">Black<")).not.toMatch(/\sdisabled=""/);
  });

  it("announces nothing on load", () => {
    const out = view(model());
    expect(out).toMatch(/<p role="status" class="sr-only"><\/p>/);
    expect(out).not.toContain('role="alert"');
  });
});

describe("NoOptionView", () => {
  const noOption = (on: DecisionSession) =>
    renderToStaticMarkup(<NoOptionView session={on} onSave={noop} onEnd={noop} />);

  it("shows the path, the h1, Choose an option, Save and End, and no error", () => {
    const out = noOption(session);
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(new RegExp(`<h1[^>]*>${session.title}</h1>`));
    expect(out).toContain("Choose an option");
    expect(out).toContain(`/projects/pica/d/${session.id}?view=options`);
    expect(count(out, "Save for later")).toBe(1);
    expect(out).toContain("End without buying");
    expect(out).not.toContain("Continue to checkout");
    expect(out).not.toContain('role="alert"');
  });

  it("points an ended decision to Done, with nothing to save or end", () => {
    const out = noOption({ ...session, decision: { status: "bought", productId: commuterId } });
    expect(out).toContain("See how this ended");
    expect(out).not.toContain("Choose an option");
    expect(out).not.toContain("Save for later");
    expect(out).not.toContain("End without buying");
  });
});
