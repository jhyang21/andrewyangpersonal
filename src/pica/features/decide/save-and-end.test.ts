import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/pica/lib/analytics", () => ({ track: () => undefined }));

import { addSession, checkoutTargetOf, createSession, dispatch, getSession } from "@/pica/lib/session";
import { resetStoreForTests } from "@/pica/lib/session/store";
import { endWithoutBuying, saveForLater } from "@/pica/features/decision/actions";
import { initialDecideState, loaded, savePress } from "./decide-model";
import { endWithNothingChosen, saveWithNothingChosen } from "./no-option-actions";

/**
 * What "Save for later" and "End without buying" write to the store when no
 * product is on screen: while it loads, after it failed, and with nothing
 * chosen. The case: a saved decision holds the pack in size L.
 */
const ID = "s1";
const size = [{ name: "Size", label: "L" }];

function stored() {
  const session = getSession(ID);
  if (!session) throw new Error("no session");
  return session;
}

/** Save as the hook does: savePress, then saveForLater with its answer. */
function pressSave(state: ReturnType<typeof initialDecideState>, productId: string) {
  const step = savePress(state, productId, checkoutTargetOf(stored()));
  if (step.kind === "save") saveForLater(ID, "decide", step.productId, step.variantId);
}

beforeEach(() => {
  const data: Record<string, string> = {};
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => (data[key] = value),
      removeItem: (key: string) => delete data[key],
    },
  });
  resetStoreForTests();
  addSession(createSession({ id: ID, at: 1, title: "Bag" }));
  dispatch(ID, { type: "decided", status: "saved", productId: "p1", variantId: "v-L", at: 2 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetStoreForTests();
});

describe("Save and End with no product on screen", () => {
  it("Save while the product loads keeps the size the decision holds", () => {
    pressSave(initialDecideState(size), "p1");
    expect(stored().decision).toMatchObject({ status: "saved", productId: "p1", variantId: "v-L" });
  });

  it("Save after the product failed to load keeps it too", () => {
    const failed = loaded(
      initialDecideState(size),
      { ok: false, error: { code: "catalog_unavailable", message: "x" }, status: 503 },
      size,
      3,
    );
    pressSave(failed, "p1");
    expect(stored().decision).toMatchObject({ status: "saved", productId: "p1", variantId: "v-L" });
  });

  it("End while loading or after a failure stores the product, and no size or colour, as before", () => {
    endWithoutBuying(ID, "decide", "p1");
    expect(stored().decision.status).toBe("declined");
    expect(stored().decision.productId).toBe("p1");
    expect(stored().decision.variantId).toBeUndefined();
  });

  it("Save with nothing chosen keeps the product and size the decision holds", () => {
    saveWithNothingChosen(stored());
    expect(stored().decision).toMatchObject({ status: "saved", productId: "p1", variantId: "v-L" });
  });

  it("Save with nothing chosen keeps what the buyer took to checkout", () => {
    dispatch(ID, { type: "checkout_started", productId: "p2", variantId: "v-M", at: 3 });
    saveWithNothingChosen(stored());
    expect(stored().decision).toMatchObject({ status: "saved", productId: "p2", variantId: "v-M" });
  });

  it("End with nothing chosen keeps the product the decision holds", () => {
    endWithNothingChosen(stored());
    expect(stored().decision.status).toBe("declined");
    expect(stored().decision.productId).toBe("p1");
  });
});
