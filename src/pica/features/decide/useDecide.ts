"use client";

import { BASE } from "@/pica/lib/base";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { track } from "@/pica/lib/analytics";
import { checkoutTargetOf, dispatch } from "@/pica/lib/session";
import type { CatalogProduct, CatalogVariant, CheckoutResponse, DecisionSession } from "@/pica/lib/types";
import { endWithoutBuying, saveForLater } from "@/pica/features/decision/actions";
import { type ApiResult, postJson, productUrl, requestJson } from "@/pica/features/shared/api";
import { now } from "@/pica/features/shared/format";
import { doneHref } from "@/pica/features/shared/journey";
import type { Selected } from "./checks";
import {
  answerCheckout,
  canStartCheckout,
  choicePending,
  choose as chooseIn,
  costsOf,
  freeCheckout,
  initialDecideState,
  loaded,
  payPress,
  press,
  primaryStep,
  retryLoad as retryIn,
  savePress,
  shownQuantity,
  withChange,
} from "./decide-model";
import { choiceGroups, initialSelection, shownStock } from "./selection";

/**
 * Everything Decide does, for one product in one decision: load price and
 * stock for the buyer's choice, check them again when old, run the two-step
 * checkout, and save or end the decision. The screen only lays it out.
 */
export function useDecide(session: DecisionSession, productId: string) {
  const router = useRouter();
  const [state, setState] = useState(() => initialDecideState(initialSelection(session, productId)));
  const [reloadKey, setReloadKey] = useState(0);
  // The latest committed state, for code that runs after an await.
  const latest = useRef(state);
  useLayoutEffect(() => {
    latest.current = state;
  });
  // False while Next keeps this page hidden after the buyer left it.
  const shown = useRef(true);
  const checkoutRequest = useRef<AbortController | null>(null);
  const selectedKey = JSON.stringify(state.selected ?? null);

  useEffect(() => {
    const controller = new AbortController();
    const selection: Selected | undefined = JSON.parse(selectedKey) ?? undefined;
    requestJson<{ product: CatalogProduct }>(productUrl(productId, selection), { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        const at = now();
        setState((current) =>
          loaded(
            current,
            result.ok ? { ok: true, product: result.data.product } : { ok: false, error: result.error, status: result.status },
            selection,
            at,
          ),
        );
      })
      .catch(() => {
        // Aborted: a newer request is on its way.
      });
    return () => controller.abort();
  }, [productId, selectedKey, reloadKey]);

  // Next hides this page, not unmounts it, when the buyer goes Back. Stop a
  // checkout request in flight so it cannot send them to the merchant later.
  useLayoutEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
      checkoutRequest.current?.abort();
      checkoutRequest.current = null;
      setState(freeCheckout);
    };
  }, []);

  // Back from the merchant: the browser may restore this page as it was left,
  // with the checkout button still busy. Free it.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) setState(freeCheckout);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const product = state.load.state === "ready" ? state.load.product : undefined;
  const variant = product?.variants[0];
  const stock = shownStock(variant);

  /** Mark the checkout start only as the buyer leaves for the merchant. */
  function leave(continueUrl: string, shownProduct: CatalogProduct, shownVariant: CatalogVariant) {
    if (!shown.current) return;
    if (!session.products[shownProduct.id]) {
      dispatch(session.id, { type: "products_merged", products: [shownProduct], at: now() });
    }
    dispatch(session.id, {
      type: "checkout_started",
      productId: shownProduct.id,
      variantId: shownVariant.id,
      options: shownVariant.options,
      at: now(),
    });
    window.location.assign(continueUrl);
  }

  async function startCheckout() {
    if (!product || !variant) return;
    const step = press(state, now());
    // Only the fields the press set, onto the latest state: a load result
    // queued just before the press must not be dropped.
    const change = step.change;
    setState((current) => withChange(current, change));
    if (step.command.kind === "recheck") {
      setReloadKey((key) => key + 1);
      return;
    }
    if (step.command.kind !== "post") return;
    checkoutRequest.current?.abort();
    const controller = new AbortController();
    checkoutRequest.current = controller;
    let result: ApiResult<CheckoutResponse>;
    try {
      result = await postJson<CheckoutResponse>(`${BASE}/api/checkout`, step.command.body, controller.signal);
    } catch {
      return; // Aborted: the buyer left this page.
    } finally {
      if (checkoutRequest.current === controller) checkoutRequest.current = null;
    }
    if (controller.signal.aborted || !shown.current) return;
    if (result.ok) {
      // Never log or track the checkout link.
      track("checkout_initiated", { productId: product.id, variantId: variant.id, mode: result.data.mode }, session.id);
    }
    const at = now();
    const posted = step.command.body.variantId;
    // Leaving cannot wait for an updater: check the latest committed state
    // that the posted variant is still the one on screen.
    const outcome = answerCheckout(latest.current, posted, result, at);
    if (outcome.leaveTo) {
      leave(outcome.leaveTo, product, variant);
      return;
    }
    // Costs, an error, or a freed button: checked again on the state React
    // holds when it applies this.
    setState((current) => withChange(current, answerCheckout(current, posted, result, at).change));
  }

  return {
    load: state.load,
    product,
    variant,
    stock,
    merchant: product?.seller.name ?? "",
    choices: product ? choiceGroups(product, variant) : [],
    choiceProblem: state.choiceProblem,
    /** A recheck the press asked for came back fine. */
    rechecked: state.rechecked,
    rechecking: state.rechecking,
    /** The quote ran out and its costs went; the screen says why. */
    quoteRanOut: state.quoteRanOut,
    checkout: state.checkout,
    busy: state.checkout.state === "busy" || state.rechecking,
    /** A new choice is loading: checkout waits for its price and stock. */
    choosing: choicePending(state),
    canStart: canStartCheckout(variant, stock),
    step: primaryStep(state),
    costs: costsOf(state.checkout),
    quantity: shownQuantity(state.checkout),

    choose(name: string, label: string) {
      if (!variant) return;
      setState((current) => chooseIn(current, variant, name, label));
    },
    startCheckout() {
      void startCheckout();
    },
    /** Second step: the costs are shown, go and pay at the merchant. */
    pay() {
      if (!product || !variant) return;
      const step = payPress(state, now());
      if (step.command.kind === "leave") {
        leave(step.command.url, product, variant);
        return;
      }
      // An expired quote: drop the costs and go back to "Continue to checkout".
      const change = step.change;
      setState((current) => withChange(current, change));
    },
    retryLoad() {
      setState(retryIn);
      setReloadKey((key) => key + 1);
    },
    save() {
      // Waits while a new choice loads: the variant on screen is still the old one.
      const step = savePress(state, productId, checkoutTargetOf(session));
      if (step.kind === "none") return;
      saveForLater(session.id, "decide", step.productId, step.variantId);
      router.push(doneHref(session.id));
    },
    decline() {
      endWithoutBuying(session.id, "decide", product?.id ?? productId);
      router.push(doneHref(session.id));
    },
  };
}

export type DecideModel = ReturnType<typeof useDecide>;
