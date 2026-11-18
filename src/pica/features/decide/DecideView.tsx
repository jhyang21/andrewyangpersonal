"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import {
  Button,
  Card,
  Chip,
  EvidenceTag,
  Price,
  ProductImage,
  Rating,
  Skeleton,
  cn,
} from "@/pica/components/kit";
import type { CatalogProduct, DecisionSession } from "@/pica/lib/types";
import { EVIDENCE_SHEET_ID, EndDecisionSheet, ErrorNotice, EvidenceSheet, JourneyPath, StorageNotice } from "@/pica/features/parts";
import { useFocusWhenGone } from "@/pica/features/decision/useFocusWhenGone";
import { checkedText, productImage } from "@/pica/features/shared/format";
import { doneHref } from "@/pica/features/shared/journey";
import { primaryLabel } from "./decide-model";
import {
  DECIDE,
  choiceProblemError,
  pressAnnouncement,
  costRows,
  entryOf,
  focusAfterLoad,
  handoffText,
  noPolicyText,
  optionsHref,
  policyLinks,
  quantityNote,
  quoteRanOutText,
  quoteUntilText,
  showsEndActions,
  stockLine,
  tradeoffOf,
  type TradeoffLine,
} from "./decide-screen-model";
import type { DecideModel } from "./useDecide";

interface DecideFrameProps {
  session: DecisionSession;
  /** The product on screen, for the path. Leave out when no option is chosen. */
  productId?: string;
  /** "Back to your options" waits while a checkout request runs. */
  backDisabled?: boolean;
  /** "Did you buy it?", from the screen. Tests leave it out. */
  returnCheck?: ReactNode;
  children: ReactNode;
}

/** What every Decide state shares: the path, the way back, the decision's title as the h1. */
function DecideFrame({ session, productId, backDisabled = false, returnCheck, children }: DecideFrameProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Answering "Did you buy it?" removes the card: put focus on the h1, not the page body.
  useFocusWhenGone(Boolean(session.checkoutStartedAt), heading);
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-3 px-4 pb-12 pt-3">
      <StorageNotice />
      <JourneyPath session={session} current="decide" chosenProductId={productId} />
      <Link
        href={optionsHref(session.id)}
        // Off while the checkout request runs. The browser's Back still works and stops it.
        aria-disabled={backDisabled || undefined}
        tabIndex={backDisabled ? -1 : undefined}
        onClick={(event) => {
          if (backDisabled) event.preventDefault();
        }}
        className={cn(
          "-ml-1 inline-flex min-h-11 items-center gap-1.5 self-start rounded-pill px-1 text-body font-medium underline-offset-4",
          backDisabled ? "cursor-not-allowed text-ink-soft" : "text-ink hover:underline",
        )}
      >
        <ArrowLeft aria-hidden size={18} className="shrink-0" />
        {DECIDE.back}
      </Link>
      <h1 ref={heading} tabIndex={-1} className="break-words text-heading font-semibold text-ink outline-none">
        {session.title}
      </h1>
      {returnCheck}
      {children}
    </main>
  );
}

interface EndActionsProps {
  onSave: () => void;
  onEnd: () => void;
  saveDisabled?: boolean;
  endDisabled?: boolean;
  saveRef?: Ref<HTMLElement>;
}

/**
 * "Save for later" and "End without buying": the same size as each other and
 * as the checkout button above them. Ending asks once, in a sheet.
 */
function EndActions({ onSave, onEnd, saveDisabled = false, endDisabled = false, saveRef }: EndActionsProps) {
  const [asking, setAsking] = useState(false);
  const sheetId = useId();
  return (
    <>
      <Button ref={saveRef} size="lg" fullWidth on="canvas" disabled={saveDisabled} onClick={onSave}>
        {DECIDE.save}
      </Button>
      <Button
        size="lg"
        fullWidth
        on="canvas"
        disabled={endDisabled}
        aria-haspopup="dialog"
        aria-controls={sheetId}
        onClick={() => setAsking(true)}
      >
        {DECIDE.end}
      </Button>
      <EndDecisionSheet
        id={sheetId}
        open={asking}
        onClose={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          onEnd();
        }}
      />
    </>
  );
}

export interface NoOptionViewProps {
  session: DecisionSession;
  onSave: () => void;
  onEnd: () => void;
  returnCheck?: ReactNode;
}

/**
 * No option chosen, or one the decision does not hold: point to Options.
 * Never an error. An ended decision points to Done instead.
 */
export function NoOptionView({ session, onSave, onEnd, returnCheck }: NoOptionViewProps) {
  const live = showsEndActions(session.decision.status);
  return (
    <DecideFrame session={session} returnCheck={returnCheck}>
      {live ? (
        <section className="flex flex-col items-start gap-3 rounded-card bg-surface p-4">
          <p className="text-body-lg text-ink">{DECIDE.noOption}</p>
          <Button href={optionsHref(session.id)}>{DECIDE.chooseOption}</Button>
        </section>
      ) : null}
      <section aria-label="Your decision" className="mt-2 flex flex-col gap-3">
        {live ? <EndActions onSave={onSave} onEnd={onEnd} /> : <SeeEnding sessionId={session.id} />}
      </section>
    </DecideFrame>
  );
}

export interface DecideViewProps {
  session: DecisionSession;
  productId: string;
  decide: DecideModel;
  returnCheck?: ReactNode;
}

/** Decide for one product: what it is, what it costs you, then buy, save or end. */
export function DecideView({ session, productId, decide, returnCheck }: DecideViewProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const { load, product, checkout } = decide;
  const entry = entryOf(session, productId);
  const live = showsEndActions(session.decision.status);
  const continueButton = useRef<HTMLElement | null>(null);
  const saveButton = useRef<HTMLElement>(null);
  const endingLink = useRef<HTMLElement>(null);
  const lastFocused = useLastFocused();
  const retried = useRef(false);

  // "Try again" and a failed load each remove the button that held focus.
  useEffect(() => {
    const active = document.activeElement;
    const focusLost = active === null || active === document.body;
    const wasOnContinue = continueButton.current !== null && lastFocused.current === continueButton.current;
    const target = focusAfterLoad({ load: load.state, live, retried: retried.current, wasOnContinue, focusLost });
    retried.current = false;
    if (target === "continue") continueButton.current?.focus();
    if (target === "ending") endingLink.current?.focus();
    if (target === "save") saveButton.current?.focus();
  }, [load.state, live, lastFocused]);

  const retry = () => {
    retried.current = true;
    decide.retryLoad();
  };

  return (
    <DecideFrame
      session={session}
      productId={productId}
      backDisabled={checkout.state === "busy"}
      returnCheck={returnCheck}
    >
      {load.state === "loading" ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <p className="sr-only">{DECIDE.loading}</p>
          <Card className="flex flex-col gap-4 sm:flex-row">
            <Skeleton className="aspect-square w-full sm:w-48 sm:shrink-0" />
            <Skeleton variant="text" lines={4} className="flex-1" />
          </Card>
          <Skeleton className="h-32 rounded-card" />
        </div>
      ) : null}

      {load.state === "failed" ? (
        // The notice offers "Try again" only for errors that may pass on a second try.
        <ErrorNotice error={load.error} where="decide" sessionId={session.id} onRetry={retry} />
      ) : null}

      {product ? (
        <Loaded
          session={session}
          product={product}
          decide={decide}
          ended={!live}
          tradeoff={tradeoffOf(entry)}
          onEvidence={() => setEvidenceOpen(true)}
        />
      ) : null}

      <section aria-label="Your decision" className="mt-2 flex flex-col gap-3">
        {live ? (
          <>
            {load.state === "loading" || product ? (
              <Primary
                decide={decide}
                // Kept after the button goes, to tell whether focus was on it.
                buttonRef={(el) => {
                  if (el) continueButton.current = el;
                }}
              />
            ) : null}
            <EndActions
              saveRef={saveButton}
              onSave={decide.save}
              onEnd={decide.decline}
              // Off while a new choice loads, so Save cannot keep the old size or colour.
              saveDisabled={decide.busy || decide.choosing}
              endDisabled={decide.busy}
            />
            {product ? <p className="text-body text-ink-soft">{handoffText(decide.merchant)}</p> : null}
          </>
        ) : (
          <SeeEnding sessionId={session.id} linkRef={endingLink} />
        )}
      </section>

      <EvidenceSheet
        id={EVIDENCE_SHEET_ID}
        sessionId={session.id}
        product={evidenceOpen && product ? product : null}
        entry={entry}
        onClose={() => setEvidenceOpen(false)}
      />
    </DecideFrame>
  );
}

/**
 * The one purple button, at the step the checkout is on. The same element
 * from loading to paying. While the product loads it is busy, not disabled:
 * a disabled button would drop the focus it holds.
 */
function Primary({ decide, buttonRef }: { decide: DecideModel; buttonRef?: Ref<HTMLElement> }) {
  const pay = decide.step === "pay";
  const loadingProduct = decide.load.state === "loading";
  return (
    <Button
      ref={buttonRef}
      variant="primary"
      size="lg"
      fullWidth
      // Busy too while a new choice loads, so checkout cannot start on the old one.
      loading={!pay && (loadingProduct || decide.busy || decide.choosing)}
      disabled={!pay && !loadingProduct && !decide.canStart}
      onClick={pay ? decide.pay : decide.startCheckout}
    >
      {primaryLabel(decide.step, decide.merchant)}
    </Button>
  );
}

/**
 * The element that last took focus. A removed element passes focus to the
 * body without a `focusin`, so after a removal this still names it.
 * Gap left on purpose: after a blank header click, a failed load still moves
 * focus to Save. Clearing on `focusout` breaks removal: Chrome fires one then.
 */
function useLastFocused() {
  const last = useRef<EventTarget | null>(null);
  useEffect(() => {
    const note = (event: FocusEvent) => {
      last.current = event.target;
    };
    document.addEventListener("focusin", note);
    return () => document.removeEventListener("focusin", note);
  }, []);
  return last;
}

/** An ended decision's one way on. */
function SeeEnding({ sessionId, linkRef }: { sessionId: string; linkRef?: Ref<HTMLElement> }) {
  return (
    <Button ref={linkRef} href={doneHref(sessionId)} size="lg" fullWidth on="canvas">
      {DECIDE.seeEnding}
    </Button>
  );
}

function Loaded({
  session,
  product,
  decide,
  ended,
  tradeoff,
  onEvidence,
}: {
  session: DecisionSession;
  product: CatalogProduct;
  decide: DecideModel;
  /** Bought or ended without buying: the product and the tradeoff only, no choices or costs. */
  ended: boolean;
  tradeoff: ReturnType<typeof tradeoffOf>;
  onEvidence: () => void;
}) {
  const { variant, merchant, checkout } = decide;
  const policies = policyLinks(product.seller.links);

  return (
    <>
      <Card as="section" className="flex flex-col gap-4 sm:flex-row">
        <ProductImage
          image={productImage(product, variant)}
          alt={product.title}
          eager
          className="w-full sm:w-48 sm:shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 className="break-words text-body-lg font-semibold text-ink">
            {product.title}
          </h2>
          <p className="break-words text-body text-ink-muted">{merchant}</p>
          {variant ? (
            <Price price={variant.price} otherVersions={product.priceRange} size="lg" />
          ) : (
            <p className="text-body-lg font-semibold text-ink">{DECIDE.notListed}</p>
          )}
          <Rating rating={product.rating} />
          {/* Read out when a new choice changes the stock, not on load. */}
          <p role="status" className="text-body text-ink">
            {stockLine(decide.stock)}
          </p>
          {/* Decide loads the product fresh, so the check is always today: show the time alone. */}
          <p className="text-caption text-ink-muted">{checkedText(product.fetchedAt, product.fetchedAt)}</p>
        </div>
      </Card>

      {decide.rechecked ? <p className="px-1 text-body text-ink">{DECIDE.rechecked}</p> : null}

      <Tradeoff tradeoff={tradeoff} goal={session.canvas.outcome?.text ?? null} onEvidence={onEvidence} />

      {ended ? null : (
        <>
          {decide.choiceProblem ? (
            <ErrorNotice error={choiceProblemError(decide.choiceProblem)} where="decide" sessionId={session.id} />
          ) : null}

          <Choices decide={decide} />

          <Card as="section" className="flex flex-col gap-3">
            <h2 className="text-body-lg font-semibold text-ink">{DECIDE.cost}</h2>
            <Costs decide={decide} />
            <div className="flex flex-col gap-1 border-t border-hairline pt-3">
              <h3 className="text-body font-semibold text-ink">{DECIDE.policies}</h3>
              {policies.length > 0 ? (
                <ul className="flex flex-wrap gap-x-4">
                  {policies.map((link) => (
                    <li key={`${link.label}-${link.url}`} className="min-w-0">
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 max-w-full items-center gap-1.5 text-body font-medium text-ink underline underline-offset-4">
                        <span className="min-w-0 break-words">{link.label}</span>
                        <ExternalLink aria-hidden size={14} className="shrink-0" />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-ink">{noPolicyText(merchant)}</p>
              )}
            </div>
          </Card>

          {/* Says what a press changed. Empty on load, so nothing is read then. */}
          <p role="status" className="sr-only">
            {pressAnnouncement(decide, merchant)}
          </p>

          {checkout.state === "failed" ? (
            <ErrorNotice error={checkout.error} where="checkout" sessionId={session.id} onRetry={decide.startCheckout} />
          ) : null}
        </>
      )}
    </>
  );
}

/** "Why it fits you" and "Why you might not want it": the same size, the same weight. */
function Tradeoff({
  tradeoff,
  goal,
  onEvidence,
}: {
  tradeoff: ReturnType<typeof tradeoffOf>;
  /** The buyer's goal, restated so the last look is against it. */
  goal: string | null;
  onEvidence: () => void;
}) {
  return (
    <Card as="section" className="flex flex-col gap-3">
      {/* One tag for the section: the reasons under it are Pica's. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-body-lg font-semibold text-ink">{DECIDE.tradeoff}</h2>
        {tradeoff && (tradeoff.fits.given || tradeoff.not.given) ? <EvidenceTag basis="inference" /> : null}
      </div>
      {goal ? (
        <p className="break-words text-body text-ink">
          <span className="font-semibold">{DECIDE.goal}: </span>
          {goal}
        </p>
      ) : null}
      {tradeoff ? (
        <dl className="flex flex-col gap-3">
          <Claim label={DECIDE.whyFits} line={tradeoff.fits} />
          <Claim label={DECIDE.whyNot} line={tradeoff.not} />
        </dl>
      ) : (
        <p className="text-body text-ink">{DECIDE.noRead}</p>
      )}
      <Button fullWidth aria-haspopup="dialog" aria-controls={EVIDENCE_SHEET_ID} onClick={onEvidence}>
        {DECIDE.seeEvidence}
      </Button>
    </Card>
  );
}

/** A missing line keeps its label and place. */
function Claim({ label, line }: { label: string; line: TradeoffLine }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-body font-semibold text-ink">{label}</dt>
      <dd className="break-words text-body text-ink">{line.text}</dd>
    </div>
  );
}

/** Size, colour and the like, as chips. A sold-out value is off and says so. */
function Choices({ decide }: { decide: DecideModel }) {
  if (decide.choices.length === 0) return null;
  return (
    <Card as="section" className="flex flex-col gap-4">
      <h2 className="text-body-lg font-semibold text-ink">{DECIDE.choice}</h2>
      {decide.choices.map((group) =>
        group.fixed ? (
          <p key={group.name} className="break-words text-body text-ink">
            <span className="font-semibold">{group.name}:</span> {group.values[0]?.label}
          </p>
        ) : (
          <fieldset key={group.name} className="flex min-w-0 flex-col gap-2">
            <legend className="mb-2 break-words text-body font-semibold text-ink">
              {group.name}
              {group.current ? <span className="font-normal">: {group.current}</span> : null}
            </legend>
            <div className="flex flex-wrap gap-x-2 gap-y-3">
              {group.values.map((value) => (
                <Chip
                  key={value.label}
                  label={value.soldOut ? `${value.label}, sold out` : value.label}
                  selected={value.selected}
                  disabled={value.soldOut || decide.busy}
                  onClick={() => {
                    if (!value.selected) decide.choose(group.name, value.label);
                  }}
                />
              ))}
            </div>
          </fieldset>
        ),
      )}
    </Card>
  );
}

/** Before the press, one line; after it, the merchant's costs as sent. */
function Costs({ decide }: { decide: DecideModel }) {
  const { costs, merchant } = decide;
  if (!costs) {
    return (
      <>
        {decide.quoteRanOut ? <p className="text-body text-ink">{quoteRanOutText(merchant)}</p> : null}
        <p className="text-body text-ink">{DECIDE.beforeCosts}</p>
      </>
    );
  }
  const until = quoteUntilText(costs.expiresAt);
  const quantity = quantityNote(decide.quantity, merchant);
  return (
    <>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-body text-ink">
        {costRows(costs.totals, merchant).map((row) => (
          <div key={row.label} className="contents">
            <dt className={cn("break-words", row.total && "font-semibold")}>{row.label}</dt>
            <dd className={cn("text-right tabular-nums", row.total && "font-semibold")}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {until ? <p className="text-body text-ink">{until}</p> : null}
      {quantity ? <p className="text-body text-ink">{quantity}</p> : null}
    </>
  );
}
