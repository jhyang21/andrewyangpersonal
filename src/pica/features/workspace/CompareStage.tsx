"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Banner, Button, Card, EmptyState, EvidenceTag, ProductImage, Skeleton } from "@/pica/components/kit";
import { Pica } from "@/pica/components/mascot";
import { track } from "@/pica/lib/analytics";
import { useFreshProducts } from "@/pica/features/shared/freshness";
import { productImage } from "@/pica/features/shared/format";
import {
  canAskCompare,
  canShowTable,
  compareAsk,
  compareRequestText,
  comparedProducts,
  comparisonState,
  comparisonViewKey,
  pickCandidates,
} from "./compare-model";
import {
  COMPARE_STAGE,
  compareButtonText,
  compareCaution,
  comparisonGap,
  layoutClasses,
  pickedProducts,
  picksChangedBody,
} from "./compare-stage-model";
import { ComparisonStack, ComparisonTable } from "./ComparisonViews";
import { EndWithoutBuying } from "./EndWithoutBuying";
import { PICKS_LOCKED, canEnd, pickControl, picksText } from "./options-stage-model";
import type { StageProps } from "./stage-workspace";
import { useOwnReply } from "./useOwnReply";
import { useViewedOnce } from "./useViewedOnce";

export const COMPARE_HEADING_ID = "compare-title";
const TABLE_HEADING_ID = "compare-table-heading";

/**
 * Grey shapes in the table's place while Pica writes the comparison. No
 * Pica here: the thinking Pica shows in the chat or the docked thread only.
 */
function ComparisonLoading() {
  return (
    <Card padding="md">
      <div aria-busy="true" className="grid grid-cols-[repeat(auto-fill,minmax(min(160px,100%),1fr))] gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="size-16 rounded-thumb" />
            <Skeleton variant="text" lines={4} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * "This comparison reflects your earlier needs", with one "Update comparison".
 * - Its own reply: the button shows the spinner and keeps focus.
 * - A reply started elsewhere: the button hides, unless focus is inside the
 *   banner; then it stays, held (off, but it keeps focus), until the reply
 *   ends.
 * - If the banner goes while focus is inside it, focus moves to the
 *   comparison heading, else the stage heading.
 */
function NeedsChangedBanner({ busy, mine, onUpdate }: { busy: boolean; mine: boolean; onUpdate: () => void }) {
  const [focusIn, setFocusIn] = useState(false);
  const [held, setHeld] = useState(false);
  const hadFocus = useRef(false);
  if (busy && !mine && focusIn && !held) setHeld(true);
  if (!busy && held) setHeld(false);

  useEffect(() => {
    return () => {
      // Runs once the banner has left the page. Take focus back only when it
      // fell to the page body, never from another control.
      if (!hadFocus.current) return;
      const active = document.activeElement;
      if (active && active !== document.body) return;
      const heading = document.getElementById(TABLE_HEADING_ID) ?? document.getElementById(COMPARE_HEADING_ID);
      heading?.focus();
    };
  }, []);

  const action = mine
    ? { label: COMPARE_STAGE.update, loading: true }
    : busy
      ? held
        ? { label: COMPARE_STAGE.update, held: true }
        : undefined
      : { label: COMPARE_STAGE.update, onClick: onUpdate };

  return (
    <div
      onFocus={() => {
        hadFocus.current = true;
        setFocusIn(true);
      }}
      onBlur={(e) => {
        // A button turning off drops focus to the body (no related target);
        // that still counts as inside. Moving to another control does not.
        const next = e.relatedTarget;
        if (next && !e.currentTarget.contains(next)) {
          hadFocus.current = false;
          setFocusIn(false);
        }
      }}
    >
      <Banner tone="caution" title={COMPARE_STAGE.needsChanged} action={action}>
        {COMPARE_STAGE.needsChangedBody}
      </Banner>
    </div>
  );
}

/**
 * Compare (brief 6.4): pick two to five options, ask Pica once, and read its
 * main tradeoff first, then the table that backs it. The needs edit in the
 * summary strip's sheet, not here. A stale comparison says so and offers one
 * way to update it.
 */
export function CompareStage({ ws, active, evidenceSheetId }: StageProps) {
  const { session, busy } = ws;
  const { shortlist, comparison } = session;
  const compared = comparedProducts(session);
  const fresh = useFreshProducts(session.id, compared, active);

  // Only an ask from here shows the grey shapes; a chat message does not.
  const reply = useOwnReply(busy);
  const loading = reply.mine;
  // "Update comparison" keeps the table and its banner, with its own spinner.
  const update = useOwnReply(busy);

  // "Compare these N" goes once the table it asked for is on screen. If it
  // had focus, focus moves to the comparison heading, else the stage
  // heading, as when the out-of-date banner goes. Only from the page body.
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const tableHeading = useRef<HTMLHeadingElement>(null);
  const askHadFocus = useRef(false);
  const askRef = useCallback((node: HTMLDivElement) => {
    return () => {
      askHadFocus.current = node.contains(document.activeElement);
    };
  }, []);
  useEffect(() => {
    if (!askHadFocus.current) return;
    askHadFocus.current = false;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    (tableHeading.current ?? stageHeading.current)?.focus();
  });

  // Once per comparison per page load.
  useViewedOnce("comparison_viewed", active && comparison ? comparisonViewKey(session.id, comparison) : null, () => {
    if (comparison) {
      track("comparison_viewed", { count: comparison.productIds.length, stale: comparison.stale }, session.id);
    }
  });

  if (!shortlist) {
    return (
      <section aria-label={COMPARE_STAGE.title}>
        <EmptyState
          art={<Pica pose="weighing" size={120} />}
          title={COMPARE_STAGE.emptyTitle}
          description={COMPARE_STAGE.emptyBody}
          action={
            <Button on="canvas" onClick={ws.goToChat}>
              {COMPARE_STAGE.emptyAction}
            </Button>
          }
        />
      </section>
    );
  }

  const { min } = ws.pickLimits;
  const candidates = pickCandidates(session);
  const picked = pickedProducts(session, ws.picks);
  const canAsk = canAskCompare(picked.length, busy, ws.pickLimits);
  const showTable = !loading && canShowTable(comparison, compared.length, min);
  const caution = showTable && comparison ? compareCaution(comparisonState(comparison, ws.picks)) : null;
  // One ask at a time. While its own ask runs there is no table, so the button stays, with the spinner.
  const showAsk = compareAsk(comparison, showTable, ws.picks) === "stage";
  const gap = comparisonGap({
    hasComparison: comparison !== null,
    comparedCount: compared.length,
    candidateCount: candidates.length,
    limits: ws.pickLimits,
  });
  const layout = layoutClasses(compared.length);

  function ask() {
    if (ws.send(compareRequestText(picked))) reply.asked();
  }

  const viewProps = comparison
    ? {
        sessionId: session.id,
        comparison,
        products: compared,
        freshness: fresh.freshness,
        today: fresh.today,
        onEvidence: (id: string) => ws.openEvidence(id),
        evidenceSheetId,
      }
    : null;

  return (
    <section aria-labelledby={COMPARE_HEADING_ID} className="@container flex min-w-0 flex-col gap-4">
      <h2 ref={stageHeading} id={COMPARE_HEADING_ID} tabIndex={-1} className="text-heading font-semibold text-ink">
        {COMPARE_STAGE.title}
      </h2>

      <section aria-labelledby="compare-pick-heading">
        <Card padding="md" className="flex flex-col gap-3">
          <h3 id="compare-pick-heading" className="text-body-lg font-semibold text-ink">
            {COMPARE_STAGE.pickHeading}
          </h3>
          <div className="flex flex-col gap-0.5">
            <p role="status" className="text-body text-ink">
              {picksText(ws.picks.length, ws.pickLimits, candidates.length)}
            </p>
            {ws.picksLocked ? <p className="text-body text-ink-muted">{PICKS_LOCKED}</p> : null}
          </div>
          <ul className="flex flex-wrap gap-2">
            {candidates.map((product) => {
              const pick = pickControl(ws.picks, product.id, ws.pickLimits.max, ws.picksLocked);
              return (
                <li key={product.id} className="max-w-full">
                  <Button pressed={pick.pressed} disabled={pick.disabled} onClick={() => ws.togglePick(product.id)}>
                    <span className="inline-flex items-center gap-2 text-left">
                      <ProductImage image={productImage(product)} alt="" radius="thumb" className="w-8 shrink-0" />
                      {/* A word wider than the button breaks rather than push the page sideways (large text, 360px). */}
                      <span className="min-w-0 wrap-anywhere">
                        <span className="sr-only">Compare </span>
                        {product.title}
                      </span>
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
          {showAsk ? (
            <div ref={askRef}>
              {/* As "None of these fit": a spinner, keeping focus, for its own ask only. */}
              <Button loading={loading} disabled={!canAsk && !loading} onClick={ask}>
                {compareButtonText(picked.length, min)}
              </Button>
            </div>
          ) : null}
        </Card>
      </section>

      {/* The answer before the proof: Pica's tradeoff, then the table. */}
      {showTable && comparison?.takeaway ? (
        <section aria-labelledby="compare-takeaway-heading">
          <Card padding="md" className="flex flex-col items-start gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="compare-takeaway-heading" className="text-body-lg font-semibold text-ink">
                {COMPARE_STAGE.takeaway}
              </h3>
              <EvidenceTag basis="inference" />
            </div>
            <p className="break-words text-body-lg text-ink">{comparison.takeaway}</p>
          </Card>
        </section>
      ) : null}

      {loading || showTable || gap.kind === "lost" ? (
        <section aria-labelledby={TABLE_HEADING_ID} className="flex flex-col gap-3">
          <h3 ref={tableHeading} id={TABLE_HEADING_ID} tabIndex={-1} className="text-body-lg font-semibold text-ink">
            {COMPARE_STAGE.tableHeading}
          </h3>
          {loading ? <ComparisonLoading /> : null}
          {caution === "picks_changed" ? (
            <Banner tone="caution" title={COMPARE_STAGE.picksChanged}>
              {picksChangedBody(ws.pickLimits)}
            </Banner>
          ) : null}
          {caution === "needs_changed" ? (
            <NeedsChangedBanner
              busy={busy}
              mine={update.mine}
              onUpdate={() => {
                if (ws.send(compareRequestText(compared))) update.asked();
              }}
            />
          ) : null}
          {showTable && viewProps ? (
            <>
              <div className={layout.table}>
                <ComparisonTable {...viewProps} idPrefix="compare-table" />
              </div>
              <div className={layout.stack}>
                <ComparisonStack {...viewProps} idPrefix="compare-stack" />
              </div>
            </>
          ) : null}
          {!loading && gap.kind === "lost" ? <p className="break-words text-body text-ink">{gap.text}</p> : null}
        </section>
      ) : null}

      {!loading && !showTable && gap.kind === "empty" ? (
        <EmptyState
          headingLevel="h3"
          art={<Pica pose="weighing" size={120} />}
          title={COMPARE_STAGE.noComparisonTitle}
          description={gap.text}
        />
      ) : null}

      {canEnd(session.decision.status) ? (
        <div>
          <EndWithoutBuying sheetId="compare-end" onConfirm={ws.decline} />
        </div>
      ) : null}
    </section>
  );
}
