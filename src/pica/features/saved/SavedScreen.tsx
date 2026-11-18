"use client";

import { BASE } from "@/pica/lib/base";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, Card, EmptyState, ProductImage, Sheet, Skeleton } from "@/pica/components/kit";
import { Pica } from "@/pica/components/mascot";
import type { DecisionSession } from "@/pica/lib/types";
import { ReturnCheckView, StorageNotice } from "@/pica/features/parts";
import { useReturnCheck } from "@/pica/features/decision/useReturnCheck";
import { formatDate } from "@/pica/features/shared/format";
import { CheckInSheet } from "./CheckInSheet";
import { SavedCardMenu } from "./SavedCardMenu";
import { decisionFacts } from "./saved-card-model";
import { savedCard, type SavedGroup } from "./saved-model";
import {
  GROUPS,
  SAVED,
  SAVED_HEADING_ID,
  cardProduct,
  checkInSavedStatus,
  checkInSavedText,
  focusAfterRemoval,
  removeDescription,
  savedTitleId,
  updatedText,
} from "./saved-screen-model";
import { useSaved } from "./useSaved";

export interface SavedCardViewProps {
  session: DecisionSession;
  /** "Did you buy it?", on the one card that asks it. */
  returnCheck?: ReactNode;
  onRemove: () => void;
  onCheckIn: () => void;
  removeSheetId: string;
  checkInSheetId: string;
}

/** Brief 6.8: thumbnail, title, stage facts, date, one action, and Remove in a menu. */
export function SavedCardView({ session, returnCheck, onRemove, onCheckIn, removeSheetId, checkInSheetId }: SavedCardViewProps) {
  const { resumable, canCheckIn, checkInSavedAt } = savedCard(session);
  const product = cardProduct(session);
  return (
    <Card as="article" padding="md" className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <ProductImage image={product?.images[0]} alt={product?.title} radius="thumb" className="w-16 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 id={savedTitleId(session.id)} tabIndex={-1} className="text-body-lg font-semibold break-words text-ink">
            {session.title}
          </h3>
          <p className="text-body text-ink-muted">{decisionFacts(session)}</p>
          <p className="text-caption text-ink-muted">{updatedText(formatDate(session.updatedAt))}</p>
        </div>
        <SavedCardMenu title={session.title} onRemove={onRemove} sheetId={removeSheetId} />
      </div>
      {returnCheck}
      {checkInSavedAt !== null ? <p className="text-body text-ink">{checkInSavedText(formatDate(checkInSavedAt))}</p> : null}
      <div className="flex flex-wrap gap-2">
        {/* `session_resumed` fires in the workspace when it opens, not here. */}
        <Button href={`${BASE}/d/${session.id}`}>
          {resumable ? SAVED.resume : SAVED.open}
          <span className="sr-only">: {session.title}</span>
        </Button>
        {canCheckIn ? (
          <Button aria-haspopup="dialog" aria-controls={checkInSheetId} onClick={onCheckIn}>
            {session.outcome ? SAVED.editCheckIn : SAVED.checkIn}
            <span className="sr-only">: {session.title}</span>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export interface SavedViewProps {
  ready: boolean;
  groups: SavedGroup[];
  /** The card that asks "Did you buy it?". */
  askCardId: string | null;
  renderReturnCheck: (session: DecisionSession) => ReactNode;
  onRemove: (session: DecisionSession) => void;
  onCheckIn: (sessionId: string) => void;
  removeSheetId: string;
  checkInSheetId: string;
  /** The hidden status line's words. Empty until the buyer saves something. */
  status?: string;
  notice?: ReactNode;
  /** The sheets. */
  children?: ReactNode;
}

/** Saved with no store, for tests. */
export function SavedView(props: SavedViewProps) {
  const { ready, groups, askCardId, notice, status = "" } = props;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-6 pb-12">
      <div className="flex flex-col gap-1">
        <h1 id={SAVED_HEADING_ID} tabIndex={-1} className="text-display font-semibold text-ink">
          {SAVED.heading}
        </h1>
        <p className="text-body-lg text-ink">{SAVED.line}</p>
      </div>
      {notice}
      {/* In the page from the start, so a screen reader hears it change. */}
      <p role="status" className="sr-only">
        {status}
      </p>

      {!ready ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton className="h-36 rounded-image" />
          <Skeleton className="h-36 rounded-image" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          art={<Pica pose="resting" size={120} />}
          title={SAVED.emptyTitle}
          description={SAVED.emptyLine}
          action={
            <Button variant="primary" href={BASE}>
              {SAVED.start}
            </Button>
          }
        />
      ) : (
        groups.map(({ status, sessions }) => (
          <section key={status} aria-labelledby={`group-${status}`} className="flex flex-col gap-3">
            <h2 id={`group-${status}`} className="text-heading font-semibold text-ink">
              {GROUPS[status].title}
            </h2>
            {GROUPS[status].note ? <p className="text-body text-ink">{GROUPS[status].note}</p> : null}
            <ul className="flex flex-col gap-3">
              {sessions.map((session) => (
                <li key={session.id}>
                  <SavedCardView
                    session={session}
                    returnCheck={session.id === askCardId ? props.renderReturnCheck(session) : null}
                    onRemove={() => props.onRemove(session)}
                    onCheckIn={() => props.onCheckIn(session.id)}
                    removeSheetId={props.removeSheetId}
                    checkInSheetId={props.checkInSheetId}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {props.children}
    </main>
  );
}

/** "Did you buy it?" on a Saved card. `onAnswered` runs before the answer is stored. */
function SavedReturnCheck({ session, onAnswered }: { session: DecisionSession; onAnswered: () => void }) {
  const check = useReturnCheck(session, false);
  if (!check) return null;
  return (
    <ReturnCheckView
      merchant={check.product?.seller.name ?? null}
      productTitle={check.product?.title ?? null}
      headingLevel="h4"
      onBought={() => {
        onAnswered();
        check.bought();
      }}
      onNotYet={() => {
        onAnswered();
        check.notYet();
      }}
    />
  );
}

/** Brief 6.8: find a decision and pick it up. */
export function SavedScreen() {
  const saved = useSaved();
  const { removing } = saved;
  const removeSheetId = useId();
  const checkInSheetId = useId();
  /** The element to focus once the list has changed under the buyer. */
  const focusNext = useRef<string | null>(null);
  const [status, setStatus] = useState("");
  const checkInTitle = saved.checkInSession?.title ?? "";

  // Runs after every render, after the sheet has handed focus back, so a
  // removed card's menu button or an answered question is not left holding it.
  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    document.getElementById(id)?.focus();
  });

  return (
    <SavedView
      ready={saved.ready}
      groups={saved.groups}
      askCardId={saved.askCardId}
      renderReturnCheck={(session) => (
        <SavedReturnCheck
          session={session}
          onAnswered={() => {
            focusNext.current = savedTitleId(session.id);
          }}
        />
      )}
      onRemove={saved.askRemove}
      onCheckIn={(id) => {
        // Cleared on open, so saving the same card again is heard again.
        setStatus("");
        saved.openCheckIn(id);
      }}
      removeSheetId={removeSheetId}
      checkInSheetId={checkInSheetId}
      status={status}
      notice={<StorageNotice />}
    >
      <Sheet
        id={removeSheetId}
        open={removing !== null}
        onClose={saved.keep}
        title={SAVED.removeTitle}
        description={removing ? removeDescription(removing.title) : undefined}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={saved.keep}>{SAVED.keep}</Button>
            <Button
              onClick={() => {
                if (removing) focusNext.current = focusAfterRemoval(saved.groups, removing.id);
                saved.confirmRemove();
              }}
            >
              {SAVED.confirmRemove}
            </Button>
          </div>
        }
      >
        <p className="text-body text-ink">{SAVED.removeLine}</p>
      </Sheet>
      <CheckInSheet
        id={checkInSheetId}
        session={saved.checkInSession}
        onClose={saved.closeCheckIn}
        onSaved={() => setStatus(checkInSavedStatus(checkInTitle))}
      />
    </SavedView>
  );
}
