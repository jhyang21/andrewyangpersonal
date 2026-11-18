"use client";

import { Button, Card, EmptyState, EvidenceTag } from "@/pica/components/kit";
import { Pica } from "@/pica/components/mascot";
import { track } from "@/pica/lib/analytics";
import { StaleBanner } from "@/pica/features/parts";
import { useFreshProducts } from "@/pica/features/shared/freshness";
import { EndWithoutBuying } from "./EndWithoutBuying";
import { OptionCard } from "./OptionCard";
import { OPTIONS_STAGE, PICKS_LOCKED, canEnd, optionsHeadline, pickControl, picksText } from "./options-stage-model";
import { NONE_FIT_MESSAGE, optionRows, shortlistViewKey } from "./shortlist-model";
import type { StageProps } from "./stage-workspace";
import { useOwnReply } from "./useOwnReply";
import { useViewedOnce } from "./useViewedOnce";

export const OPTIONS_HEADING_ID = "options-title";

/**
 * Options (brief 6.3): Pica's shortlist as equal cards in no order, each with
 * one reason it fits and one drawback, and a way out at the foot. The stage
 * sits on the grey canvas; the frame around it owns the chat, the evidence
 * sheet and the needs.
 */
export function OptionsStage({ ws, active, evidenceSheetId }: StageProps) {
  const { session, busy } = ws;
  const shortlist = session.shortlist;
  const noneFit = useOwnReply(busy);
  const rows = optionRows(session);
  const fresh = useFreshProducts(
    session.id,
    rows.map((row) => row.product),
    active,
  );

  // Once per shortlist per page load, and only when at least one option shows.
  const viewKey = active && shortlist && rows.length > 0 ? shortlistViewKey(session.id, shortlist) : null;
  useViewedOnce("recommendation_viewed", viewKey, () => {
    if (shortlist) {
      track("recommendation_viewed", { count: shortlist.entries.length, stale: shortlist.stale }, session.id);
    }
  });

  const empty = (
    <EmptyState
      art={<Pica pose="idle" size={120} />}
      title={OPTIONS_STAGE.emptyTitle}
      description={OPTIONS_STAGE.emptyBody}
      action={
        <Button on="canvas" onClick={ws.goToChat}>
          {OPTIONS_STAGE.emptyAction}
        </Button>
      }
    />
  );

  if (!shortlist) return <section aria-label="Options">{empty}</section>;

  const note = shortlist.note ? (
    <Card padding="md">
      <p className="break-words text-body-lg text-ink">{shortlist.note}</p>
    </Card>
  ) : null;
  const stale = <StaleBanner session={session} busy={busy} onSend={ws.send} />;

  // A shortlist whose products are all missing: keep Pica's note and the
  // stale banner, since both still hold.
  if (rows.length === 0) {
    return (
      <section aria-label="Options" className="flex min-w-0 flex-col gap-4">
        {note}
        {stale}
        {empty}
      </section>
    );
  }

  return (
    <section aria-labelledby={OPTIONS_HEADING_ID} className="@container flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Pica pose="found" size={24} className="shrink-0" />
          <h2 id={OPTIONS_HEADING_ID} className="text-heading font-semibold text-ink">
            {optionsHeadline(rows.length)}
          </h2>
        </div>
        {/* One source note for the whole stage, so no line on a card needs its own tag. */}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-ink-soft">
          <EvidenceTag basis="inference" />
          <span>{OPTIONS_STAGE.sourceNote}</span>
        </p>
      </div>

      {note}
      {stale}

      <div className="flex flex-col gap-0.5">
        {/* Read out as the picks change; nothing in it changes on load or on send. */}
        <p role="status" className="text-body text-ink">
          {picksText(ws.picks.length, ws.pickLimits, rows.length)}
        </p>
        {ws.picksLocked ? <p className="text-body text-ink-soft">{PICKS_LOCKED}</p> : null}
      </div>

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3">
        {rows.map(({ entry, product }, index) => (
          <li key={product.id} className="flex min-w-0">
            <OptionCard
              sessionId={session.id}
              entry={entry}
              product={product}
              eager={index === 0}
              freshness={fresh.freshness(product)}
              today={fresh.today}
              pick={pickControl(ws.picks, product.id, ws.pickLimits.max, ws.picksLocked)}
              onTogglePick={() => ws.togglePick(product.id)}
              onEvidence={() => ws.openEvidence(product.id)}
              evidenceSheetId={evidenceSheetId}
            />
          </li>
        ))}
      </ul>

      {/* Two plain ways out, the same size: neither is the "right" one. */}
      <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
        {/* After its own press it shows `loading`, which keeps focus and drops a
            second press. A reply started elsewhere turns it off plainly. */}
        <Button
          on="canvas"
          fullWidth
          loading={noneFit.mine}
          disabled={busy && !noneFit.mine}
          onClick={() => {
            if (ws.send(NONE_FIT_MESSAGE)) noneFit.asked();
          }}
        >
          {OPTIONS_STAGE.noneFit}
        </Button>
        {canEnd(session.decision.status) ? (
          <EndWithoutBuying sheetId="options-end" onConfirm={ws.decline} fullWidth />
        ) : null}
      </div>
    </section>
  );
}
