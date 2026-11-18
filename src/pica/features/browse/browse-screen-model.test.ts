import { describe, expect, it } from "vitest";
import { seedProducts } from "@/app/projects/pica/kit/seed/fixture";
import { browseView, type Results } from "./browse-model";
import {
  BROWSE,
  browseStatus,
  busyControl,
  focusAfterLoad,
  focusAfterLoadMore,
  shownText,
  type PendingFocus,
} from "./browse-screen-model";

const products = seedProducts(1);
const page: Results = { products, nextCursor: null };

function status(acted: boolean, state: { results: Results | null; loading: boolean; hasError?: boolean }) {
  const view = browseView({ results: state.results, loading: state.loading, error: null });
  return browseStatus({ acted, loading: state.loading, hasError: state.hasError ?? false, results: state.results, view });
}

describe("shownText", () => {
  it("counts what shows", () => {
    expect(shownText(4)).toBe("4 products shown");
    expect(shownText(1)).toBe("1 product shown");
    expect(shownText(0)).toBe("Nothing on this page");
  });
});

describe("browseStatus", () => {
  it("says nothing before the buyer acts, so nothing is read out on load", () => {
    expect(status(false, { results: null, loading: true })).toBe("");
    expect(status(false, { results: page, loading: false })).toBe("");
  });

  it("says what is loading and what came back once the buyer acts", () => {
    expect(status(true, { results: null, loading: true })).toBe(BROWSE.loading);
    expect(status(true, { results: page, loading: false })).toBe("4 products shown");
    expect(status(true, { results: { products: [], nextCursor: null }, loading: false })).toBe(BROWSE.noMatchTitle);
  });

  it("is silent again once a category is turned off and the page is back to the prompt", () => {
    const view = browseView({ results: null, loading: false, error: null });
    expect(view.prompt).toBe(true);
    expect(status(true, { results: null, loading: false })).toBe("");
  });

  it("leaves errors to their own alert", () => {
    expect(status(true, { results: page, loading: false, hasError: true })).toBe("");
  });
});

describe("focusAfterLoadMore", () => {
  it("goes to the first new product", () => {
    expect(focusAfterLoadMore(10, 14, true)).toBe(10);
    expect(focusAfterLoadMore(10, 14, false)).toBe(10);
  });

  it("stays on the button when nothing came but more pages remain", () => {
    expect(focusAfterLoadMore(10, 10, true)).toBeNull();
  });

  it("goes to the list heading when the button went away with nothing new", () => {
    expect(focusAfterLoadMore(10, 10, false)).toBe("heading");
  });
});

describe("busyControl", () => {
  it("spins the control that started the load, and nothing at rest", () => {
    expect(busyControl(true, "search")).toBe("search");
    expect(busyControl(true, "more")).toBe("more");
    expect(busyControl(false, "search")).toBeNull();
    expect(busyControl(false, "more")).toBeNull();
  });
});

describe("focusAfterLoad", () => {
  const ok = { failed: false, after: 10, hasMore: true, noMatch: false };
  const pending = (kind: PendingFocus["kind"], retry: boolean): PendingFocus => ({ kind, retry, before: 10 });

  it("after Try again on a search, goes to the results heading, or the box when nothing matched", () => {
    expect(focusAfterLoad(pending("search", true), ok)).toBe("heading");
    expect(focusAfterLoad(pending("search", true), { ...ok, after: 0, hasMore: false, noMatch: true })).toBe("box");
  });

  it("after Try again on Load more, goes to the first new product", () => {
    expect(focusAfterLoad(pending("more", true), { ...ok, after: 19 })).toBe(10);
    expect(focusAfterLoad(pending("more", true), { ...ok, after: 19, hasMore: false })).toBe(10);
  });

  it("after Try again on Load more with nothing new, goes to Load more, or the heading once it has gone", () => {
    expect(focusAfterLoad(pending("more", true), ok)).toBe("more");
    expect(focusAfterLoad(pending("more", true), { ...ok, hasMore: false })).toBe("heading");
  });

  it("after Load more, goes to the first new product, else stays on the button", () => {
    expect(focusAfterLoad(pending("more", false), { ...ok, after: 19 })).toBe(10);
    expect(focusAfterLoad(pending("more", false), ok)).toBeNull();
  });

  it("goes back to Try again when a retry fails again, and stays put when a first try fails", () => {
    expect(focusAfterLoad(pending("search", true), { ...ok, failed: true })).toBe("retry");
    expect(focusAfterLoad(pending("more", true), { ...ok, failed: true })).toBe("retry");
    expect(focusAfterLoad(pending("more", false), { ...ok, failed: true })).toBeNull();
  });

  it("leaves focus in the box or on the category after a plain search", () => {
    expect(focusAfterLoad(pending("search", false), ok)).toBeNull();
  });
});
