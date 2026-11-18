"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { firstTime, track } from "@/pica/lib/analytics";
import { dispatch, type CanvasEdit } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { endWithoutBuying, saveForLater } from "@/pica/features/decision/actions";
import { now } from "@/pica/features/shared/format";
import { doneHref } from "@/pica/features/shared/journey";
import { recordHandAdded } from "./canvas-model";
import { isBusy } from "./chat-model";
import { COMPARE_LIMITS, livePicks, togglePickUnlessLocked, type PickLimits } from "./compare-model";
import { withoutRefused } from "./frame-model";
import { useCanvasEdit } from "./useCanvasEdit";
import { usePicaChat } from "./usePicaChat";
import type { WorkspaceView } from "./views";

export interface WorkspaceOptions {
  /** The view on open, e.g. from `parseView(searchParams.view)`. */
  initialView?: WorkspaceView;
}

/**
 * The one owner of a workspace's state. `usePicaChat` is called only here, so
 * the busy flag, the error and the live announcement each have one source.
 * Screens read from this and call its actions; they hold no chat state.
 */
export function useWorkspace(session: DecisionSession, options: WorkspaceOptions = {}) {
  const router = useRouter();
  const chat = usePicaChat(session);
  const busy = isBusy(chat.status);
  const pickLimits: PickLimits = COMPARE_LIMITS;

  const [view, setView] = useState<WorkspaceView>(options.initialView ?? "chat");
  // While Pica replies the picks are locked, as the canvas is, so the reset
  // below cannot undo a change the buyer made during the reply.
  const locked = busy;
  const [pickState, setPicks] = useState<readonly string[]>(() => session.comparison?.productIds ?? []);
  // A new comparison, say one Pica made from chat, resets the picks to its
  // products, so the table does not read as covering other options. The reset
  // keys on `createdAt`: each comparison the server sends has a new one.
  const comparisonAt = session.comparison?.createdAt ?? null;
  const [picksFor, setPicksFor] = useState(comparisonAt);
  if (picksFor !== comparisonAt) {
    setPicksFor(comparisonAt);
    if (session.comparison) setPicks(session.comparison.productIds);
  }
  // Only products on the current shortlist count, so a new shortlist prunes old picks.
  const picks = livePicks(pickState, session.shortlist).slice(0, pickLimits.max);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);

  const applyEdit = useCanvasEdit(session.id);
  // Needs the buyer added by hand on this page load, for `canvasUpdates`'s
  // `byHand`. Kept in memory only: after a reload the list is empty, and a
  // canvas note counts every new need Pica's update carries as Pica's.
  const [addedByHand, setAddedByHand] = useState<readonly string[]>([]);

  useEffect(() => {
    // The one place `session_resumed` fires: once per session per page load.
    if (!firstTime(`session_resumed:${session.id}`)) return;
    // A session with a reply in it was started earlier: count it as resumed.
    if (session.messages.length > 1) {
      track("session_resumed", { status: session.decision.status }, session.id);
    }
    // Only on open: later changes are not a resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  /** Sends a buyer message. False when Pica is still replying and nothing was sent. */
  function send(text: string): boolean {
    if (busy) return false;
    chat.clearError();
    void chat.sendMessage({ text });
    return true;
  }

  /** After an error: clear it and ask again. */
  function retry() {
    chat.clearError();
    void chat.regenerate();
  }

  /** After a refused send whose words went back to the composer: take the message out of the thread. */
  function dropRefused() {
    const kept = withoutRefused(chat.messages);
    if (kept !== chat.messages) chat.setMessages(kept);
  }

  /** The last message has no reply and no error: ask again. */
  function sendAgain() {
    void chat.regenerate();
  }

  /** Does nothing while the picks are locked. */
  function togglePickFor(productId: string) {
    setPicks((ids) => togglePickUnlessLocked(ids, productId, session.shortlist, pickLimits.max, locked));
  }

  /** A buyer's canvas edit. Records the ids of needs added by hand. Returns whether it landed. */
  function editCanvas(edit: CanvasEdit): boolean {
    const landed = applyEdit(edit);
    setAddedByHand((ids) => recordHandAdded(ids, edit, landed));
    return landed;
  }

  function save() {
    saveForLater(session.id, "workspace");
    router.push(doneHref(session.id));
  }

  function decline() {
    endWithoutBuying(session.id, "workspace");
    router.push(doneHref(session.id));
  }

  function reopen() {
    dispatch(session.id, { type: "reopened", at: now() });
  }

  const evidenceProduct = evidenceId ? (session.products[evidenceId] ?? null) : null;
  const evidenceEntry = evidenceId
    ? (session.shortlist?.entries.find((entry) => entry.productId === evidenceId) ?? null)
    : null;

  return {
    session,
    messages: chat.messages,
    status: chat.status,
    busy,
    error: chat.chatError,
    announcement: chat.announcement,
    clearError: chat.clearError,

    view,
    /** Shows a view. The needs sheet is the frame's, over whatever view shows. */
    show: setView,

    picks,
    pickLimits,
    picksLocked: locked,
    togglePick: togglePickFor,

    editCanvas,
    addedByHand,

    evidence: { product: evidenceProduct, entry: evidenceEntry },
    openEvidence: setEvidenceId,
    closeEvidence: () => setEvidenceId(null),

    send,
    retry,
    sendAgain,
    dropRefused,
    save,
    decline,
    reopen,
  };
}

export type WorkspaceState = ReturnType<typeof useWorkspace>;
