"use client";

import { BASE } from "@/pica/lib/base";
import { Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefCallback, type RefObject } from "react";
import { Banner, BottomBar, Button, IntentInput, cn, type BottomBarProps } from "@/pica/components/kit";
import { PicaThinking, THINKING_LABEL } from "@/pica/components/mascot";
import { ErrorNotice, ErrorState } from "@/pica/features/parts";
import { confirmEdit } from "./canvas-model";
import { ChatThread } from "./ChatThread";
import {
  chatShape,
  COMPOSER,
  composerLabel,
  composerPlaceholder,
  isPlainClick,
  PHONE_FIXED,
  restoredDraft,
  viewHref,
  type ChatShape,
} from "./frame-model";
import { dockLine, newestReplyStart, questionLive, threadRows } from "./thread-model";
import { useChatActions } from "./useChatActions";
import type { WorkspaceState } from "./useWorkspace";

export const CHAT = {
  heading: "Chat with Pica",
  openChat: "Open chat",
  shrinkChat: "Show less",
  latest: "Latest messages",
  notices: "Chat notices",
  noReply: "Your last message has no reply yet.",
  sendAgain: "Send again",
  productsNow: "Show me products now",
  notSetUp: "Pica can't chat yet",
  goHome: "Go to Home",
} as const;

interface ShapeClasses {
  /**
   * The box that holds the chat's section and, after it, the phone's bottom
   * bar, and places them: the phone dock, the desktop column or the desktop
   * dock. It has no role, so the bar is not part of the chat's section.
   */
  frame: string;
  /** The section named "Chat with Pica": the thread, its dock line, its banners and the composer. */
  section: string;
  /** The heading row. On a phone dock it hides while typing and on a short screen. */
  titleRow: string;
  heading: string;
  /** Desktop Compare's "Show less", in the heading row while the docked thread is open. */
  toggle: string;
  /** The thread itself. Hidden on a phone dock and on a closed desktop dock, which show `dock` instead. */
  box: string;
  /** The dock's one line with "Open chat": on a phone, and on desktop Compare while closed. */
  dock: string;
  /** Desktop Compare's "Open chat" in the dock line: it opens the thread in place. */
  expand: string;
  /** Banners: an error, "no reply came". In full, scrolling inside on a phone dock. */
  notices: string;
  /** The composer. On a phone's Chat it sticks just above the bar. */
  composer: string;
  /** The phone's bottom bar, edge to edge under the composer, outside the section. */
  bar: string;
}

// The left column fills the workspace's height, which fits the screen, and
// its thread scrolls inside, so the chat never lengthens the page.
const COLUMN_DESKTOP = "lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:min-h-0 lg:self-stretch";
/*
 * The phone dock sticks to the foot of the screen with the bottom bar inside
 * it, so it sits on the bar whatever the bar's height; while the composer has
 * focus the bar steps aside (kit.css) and the dock drops with it. Its spacing
 * is in px, so large text does not grow it. The bar follows the chat's
 * section inside the dock; it is not part of the section.
 */
const DOCK_PHONE =
  "max-lg:sticky max-lg:bottom-0 max-lg:z-20 max-lg:mt-auto max-lg:-mx-4 max-lg:max-h-dvh max-lg:gap-[8px] max-lg:border-t max-lg:border-hairline max-lg:px-[16px] max-lg:py-[8px] max-lg:shadow-float";
const DOCK_BAR = "-mx-[16px] -mb-[8px] shrink-0 lg:hidden";
const DOCK_LINE = "flex items-center gap-2 lg:hidden";
// A banner gets up to a third of the screen, the reply line steps aside for
// it, and a longer one scrolls inside (brief 6.2). Only when the dock would
// pass the whole screen does the banner give up room, so the bar stays on it.
const NOTICES_DOCKED = "flex flex-col gap-3 max-lg:max-h-[calc(100dvh/3)] max-lg:min-h-0 max-lg:overflow-y-auto";
// Inside the dock, the section keeps the dock's spacing and may shrink, so a
// long banner gives up room before the bar would leave the screen.
const SECTION_DOCKED = "flex flex-col max-lg:min-h-0 max-lg:gap-[8px] lg:gap-2";

function shapeClasses(shape: ChatShape, expanded: boolean): ShapeClasses {
  switch (shape) {
    case "column":
      return {
        frame: cn("flex flex-1 flex-col", COLUMN_DESKTOP),
        section: "flex flex-1 flex-col lg:min-h-0",
        titleRow: "",
        heading: "sr-only",
        toggle: "hidden",
        box: "flex flex-col gap-3 pb-4 lg:relative lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-1 lg:pt-1",
        dock: "hidden",
        expand: "hidden",
        notices: "flex flex-col gap-3 pb-2",
        // Sticks on the bar, whose height useBarHeight keeps in --chat-bar-h;
        // the fallback is the bar's height at first paint, before that runs.
        composer: "sticky bottom-[var(--chat-bar-h,calc(46px+1rem))] z-20 mt-auto bg-canvas py-[8px] lg:static lg:pt-2 lg:pb-0",
        bar: "sticky bottom-0 z-20 -mx-4 lg:hidden",
      };
    case "docked":
      return {
        frame: cn(
          "flex flex-col bg-canvas",
          DOCK_PHONE,
          "lg:sticky lg:bottom-4 lg:z-20 lg:mx-auto lg:mt-auto lg:w-full lg:max-w-[720px] lg:gap-2 lg:rounded-card lg:border lg:border-hairline lg:px-4 lg:py-2 lg:shadow-float",
        ),
        section: SECTION_DOCKED,
        titleRow: PHONE_FIXED.titleRow,
        // Closed on desktop, the dock is one line and the composer, so the
        // table and the tradeoff stay in view; the heading is for screen readers.
        heading: expanded ? "" : "lg:sr-only",
        toggle: expanded ? "hidden lg:inline-flex" : "hidden",
        // Desktop only, and only once opened: it never shrinks while the buyer types (brief 6.2).
        box: expanded ? "flex flex-col gap-3 overflow-y-auto max-h-[50dvh] max-lg:hidden" : "hidden",
        dock: expanded ? DOCK_LINE : "flex items-center gap-2",
        expand: "hidden lg:inline-flex",
        notices: NOTICES_DOCKED,
        composer: "shrink-0",
        bar: DOCK_BAR,
      };
    case "split":
      return {
        frame: cn("flex flex-col bg-canvas", DOCK_PHONE, COLUMN_DESKTOP),
        section: cn(SECTION_DOCKED, "lg:min-h-0 lg:flex-1"),
        titleRow: PHONE_FIXED.titleRow,
        heading: "lg:sr-only",
        toggle: "hidden",
        box: "flex flex-col gap-3 max-lg:hidden lg:relative lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-1 lg:pt-1 lg:pb-4",
        dock: DOCK_LINE,
        expand: "hidden",
        notices: NOTICES_DOCKED,
        composer: "shrink-0 lg:pt-2",
        bar: DOCK_BAR,
      };
  }
}

/**
 * Keeps `--chat-bar-h` on the bar's parent equal to the bar's height, so the
 * composer on a phone's Chat sticks just above the bar at any text size, and
 * drops to the foot when the bar steps aside while typing.
 */
function useBarHeight(): RefCallback<HTMLDivElement> {
  return useCallback((el: HTMLDivElement) => {
    const frame = el.parentElement;
    if (!frame) return;
    const watch = new ResizeObserver(() => frame.style.setProperty("--chat-bar-h", `${el.offsetHeight}px`));
    watch.observe(el);
    return () => {
      watch.disconnect();
      frame.style.removeProperty("--chat-bar-h");
    };
  }, []);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Whether a box's content is taller than the box, so it scrolls. Such a box
 * becomes a tab stop, so a keyboard can scroll it; one that does not scroll
 * adds none. Checked when the box or one of its children resizes, by one
 * observer made when the box mounts.
 */
function useScrolls<T extends HTMLElement>(): [RefCallback<T>, RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const observer = useRef<ResizeObserver>(null);
  const [scrolls, setScrolls] = useState(false);
  const attach = useCallback((el: T) => {
    ref.current = el;
    const watch = new ResizeObserver(() => setScrolls(el.scrollHeight > el.clientHeight + 1));
    watch.observe(el);
    observer.current = watch;
    return () => {
      watch.disconnect();
      observer.current = null;
      ref.current = null;
    };
  }, []);
  // Children come and go with each render; watch the new ones. Watching one
  // already watched does nothing.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !observer.current) return;
    for (const child of Array.from(el.children)) observer.current.observe(child);
  });
  return [attach, ref, scrolls];
}

export interface ChatPanelProps {
  ws: WorkspaceState;
  /** Opens the needs; with an id, that need's form (a confirm card's "Edit"). */
  onOpenNeeds: (itemId?: string) => void;
  /** Give up focus after a send, so a phone's keyboard closes and the bottom bar comes back. */
  blurOnSubmit: boolean;
  /** The phone's bottom bar. It sits under the composer, so whatever sits on it never covers it. */
  bar: BottomBarProps;
  /** Bumped by "Go to chat" in an empty stage: once Chat shows, the composer takes focus. */
  composerFocus?: number;
}

/** Focus a row and bring its top into view. */
function showAtTop(target: HTMLElement) {
  target.focus({ preventScroll: true });
  // A jump, not a glide: Chrome drops a smooth scroll begun as the view swaps.
  // Next frame, and no cleanup: strict mode's second run finds the flag spent.
  requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
}

/**
 * The conversation, mounted once in every view. In Chat it is the whole
 * chat. Over Options and Compare on a phone it docks above the composer as
 * one or two lines: the start of Pica's newest reply, the thinking row, or a
 * line naming a card, with "Open chat" beside it. On desktop Compare it docks
 * and expands in place; from 1024px Options sits
 * beside it as a column. Mounting it once means the thinking row, an error
 * and an open question each show in one place. Sending never changes the view.
 */
export function ChatPanel({ ws, onOpenNeeds, blurOnSubmit, bar, composerFocus = 0 }: ChatPanelProps) {
  const { session, messages, status, busy, error } = ws;
  const actions = useChatActions(ws);
  const shape = chatShape(ws.view);
  const [expanded, setExpanded] = useState(false);
  const baseId = useId();
  const boxId = `${baseId}-box`;
  const replyId = `${baseId}-reply`;
  const thinkingId = `${baseId}-thinking`;
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const notSetUpRef = useRef<HTMLDivElement>(null);
  const [attachBox, boxRef, boxScrolls] = useScrolls<HTMLDivElement>();
  const [attachNotices, noticesRef, noticesScrolls] = useScrolls<HTMLDivElement>();
  const measureBar = useBarHeight();
  const boxRegion = shape === "docked" && boxScrolls;
  const failed = Boolean(error);

  const rows = threadRows(messages, { byHand: ws.addedByHand });
  const classes = shapeClasses(shape, expanded);
  const notices = failed || actions.unanswered;
  const line = dockLine(rows, { busy, banner: notices, canvas: session.canvas });

  // The composer's text, held here so a refused message can come back.
  const [draft, setDraft] = useState("");
  const errorKey = error ? `${error.code}:${messages.length}` : null;
  const [errorSeen, setErrorSeen] = useState(errorKey);
  // The error whose words came back to the composer.
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  if (errorSeen !== errorKey) {
    setErrorSeen(errorKey);
    const restored = restoredDraft(error?.code, draft, messages);
    if (restored !== null) {
      setDraft(restored);
      setRestoredFor(errorKey);
    }
  }
  // The words are in the composer now, so they leave the thread: sending them
  // again carries them once. Dropping the message changes the error's key,
  // so this runs once per refusal.
  const { dropRefused } = ws;
  useEffect(() => {
    if (restoredFor !== null && restoredFor === errorKey) dropRefused();
  }, [restoredFor, errorKey, dropRefused]);

  // Set by the phone dock's "Open chat"; read once Chat shows (below).
  const focusOnArrival = useRef(false);
  // Set when the thinking row goes while it has focus; read once the reply is in (below).
  const thinkingHadFocus = useRef(false);
  const thinkingRef = useCallback((node: HTMLDivElement) => {
    return () => {
      thinkingHadFocus.current = node === document.activeElement;
    };
  }, []);

  // Follow new messages and banners, and the thread when it docks; not on
  // first load, and not when "Open chat" or a focus move places the page itself.
  const seen = useRef({ count: messages.length, status, shape, notices });
  useEffect(() => {
    const last = seen.current;
    if (last.count === messages.length && last.status === status && last.shape === shape && last.notices === notices) return;
    seen.current = { count: messages.length, status, shape, notices };
    if (focusOnArrival.current || thinkingHadFocus.current) return;
    const target = noticesRef.current ?? endRef.current;
    target?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [messages.length, status, shape, notices, noticesRef]);

  // Where the thread scrolls inside its own box (docked, or the desktop
  // column), open it at the latest message. Moves the box only, never the page.
  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [shape, expanded, boxRef]);

  // A new view starts with the thread docked small.
  const [shapeSeen, setShapeSeen] = useState(shape);
  if (shapeSeen !== shape) {
    setShapeSeen(shape);
    setExpanded(false);
  }

  // Desktop Compare: "Open chat" and "Show less" each hide as they act, so
  // focus moves to the other one. Only after a press, never on a view change.
  const toggleRef = useRef<HTMLButtonElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const toggled = useRef(false);
  useEffect(() => {
    if (!toggled.current) return;
    toggled.current = false;
    (expanded ? toggleRef : expandRef).current?.focus();
  }, [expanded]);
  function toggle() {
    toggled.current = true;
    setExpanded((open) => !open);
  }

  function focusComposer() {
    composerRef.current?.focus();
  }

  // "Go to chat" in an empty stage: once Chat shows, the composer takes
  // focus, as after "Open chat" with no reply to show. On desktop Chat may
  // already sit beside the stage; the composer still takes focus.
  const composerFocusSeen = useRef(composerFocus);
  useEffect(() => {
    if (shape !== "column" || composerFocusSeen.current === composerFocus) return;
    composerFocusSeen.current = composerFocus;
    focusComposer();
  }, [shape, composerFocus]);

  // The phone dock's "Open chat" goes to Chat with focus on the thinking row
  // while a reply comes, else on Pica's newest reply, else on the composer;
  // when Pica can't chat, on that heading. The row scrolls to the top, below
  // the strip (its scroll margin), as the composer and the bar cover the foot.
  // No key in this tab, or one OpenAI turned down: either way the fix is on Home.
  const notSetUp = error?.code === "missing_key" || error?.code === "bad_key";
  useEffect(() => {
    if (shape !== "column" || !focusOnArrival.current) return;
    focusOnArrival.current = false;
    if (notSetUp) {
      const heading = notSetUpRef.current?.querySelector<HTMLElement>("h3");
      heading?.setAttribute("tabindex", "-1");
      return heading?.focus();
    }
    const target = document.getElementById(thinkingId) ?? document.getElementById(replyId);
    if (target) showAtTop(target);
    else focusComposer();
  }, [shape, thinkingId, replyId, notSetUp]);

  // The thinking row had focus when it went: focus moves on to the reply it
  // made way for, or to the composer when the reply failed.
  useEffect(() => {
    if (busy || !thinkingHadFocus.current) return;
    thinkingHadFocus.current = false;
    const reply = failed ? null : document.getElementById(replyId);
    if (reply) showAtTop(reply);
    else focusComposer();
  }, [busy, failed, replyId]);

  const openChatLink = (
    <Link
      href={viewHref(session.id, "chat")}
      scroll={false}
      onClick={(event) => {
        // A click that may open a new tab leaves this page as it is.
        if (isPlainClick(event)) focusOnArrival.current = true;
      }}
      // 44px tall in px, not rem, so large text does not double it. Phone only:
      // on desktop Chat already shows, or Compare's dock opens in place.
      className="inline-flex min-h-[44px] shrink-0 items-center rounded-pill px-3 text-body font-medium text-ink underline underline-offset-4 lg:hidden"
    >
      {CHAT.openChat}
    </Link>
  );

  const bottomBar = (
    <div ref={measureBar} className={classes.bar}>
      <BottomBar {...bar} />
    </div>
  );

  if (notSetUp) {
    // The full pattern where the chat has room; one plain line on a phone dock.
    const docked = shape !== "column";
    return (
      <div className={classes.frame}>
        <section aria-labelledby={`${baseId}-title`} className={classes.section}>
          <h2 id={`${baseId}-title`} className="sr-only">
            {CHAT.heading}
          </h2>
          <div ref={notSetUpRef} className={cn(docked && "max-lg:hidden")}>
            <ErrorState
              code={error.code}
              where="chat"
              sessionId={session.id}
              title={CHAT.notSetUp}
              description={error.message}
              action={{ label: CHAT.goHome, href: BASE }}
              headingLevel="h3"
            />
          </div>
          {docked ? (
            <div className="flex flex-col gap-2 lg:hidden">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 text-body text-ink">{CHAT.notSetUp}</p>
                {openChatLink}
              </div>
              <IntentInput label={composerLabel(ws.view)} submitLabel={COMPOSER.submit} disabled onSubmit={() => false} />
            </div>
          ) : null}
        </section>
        {bottomBar}
      </div>
    );
  }

  const questionOpen = actions.openQuestion !== null;

  return (
    <div className={classes.frame}>
      <section aria-labelledby={`${baseId}-title`} className={cn("group/chat", classes.section)}>
        <div className={cn("flex items-center justify-between gap-2", classes.titleRow)}>
          <h2 id={`${baseId}-title`} className={cn("text-caption font-semibold text-ink-soft", classes.heading)}>
            {CHAT.heading}
          </h2>
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={expanded}
            aria-controls={boxId}
            onClick={toggle}
            className={cn(
              "min-h-11 items-center rounded-pill px-3 text-body font-medium text-ink underline underline-offset-4",
              classes.toggle,
            )}
          >
            {CHAT.shrinkChat}
          </button>
        </div>

        {/* The dock line: two lines at most on a phone (one on a short screen), one on desktop, cut with an ellipsis. */}
        <div className={classes.dock}>
          <div className={cn("min-w-0 flex-1 text-body text-ink", PHONE_FIXED.lines, "lg:line-clamp-1")}>
            {line.kind === "thinking" ? <PicaThinking announce={false} /> : null}
            {line.kind === "card" ? line.text : null}
            {line.kind === "reply" ? (
              <>
                <span className="sr-only">Pica said: </span>
                {line.text}
              </>
            ) : null}
          </div>
          {openChatLink}
          <button
            ref={expandRef}
            type="button"
            aria-expanded={false}
            aria-controls={boxId}
            onClick={toggle}
            className={cn(
              "min-h-11 shrink-0 items-center rounded-pill px-3 text-body font-medium text-ink underline underline-offset-4",
              classes.expand,
            )}
          >
            {CHAT.openChat}
          </button>
        </div>

        {/* Where it scrolls, a tab stop with a name, so a keyboard can scroll it. */}
        <div
          ref={attachBox}
          id={boxId}
          role={boxRegion ? "region" : undefined}
          aria-label={boxRegion ? CHAT.latest : undefined}
          tabIndex={boxRegion ? 0 : undefined}
          className={classes.box}
        >
          <ChatThread
            sessionId={session.id}
            rows={rows}
            focusIndex={newestReplyStart(rows)}
            focusId={replyId}
            canvas={session.canvas}
            busy={busy}
            isLive={(toolCallId) => questionLive(messages, busy, toolCallId)}
            onAnswer={actions.answer}
            onSkip={actions.skip}
            onConfirm={(itemId) => ws.editCanvas(confirmEdit({ kind: "item", id: itemId }))}
            onOpenNeeds={onOpenNeeds}
          />

          {busy ? (
            <div ref={thinkingRef} id={thinkingId} tabIndex={-1} className="scroll-mt-20">
              <PicaThinking announce={false} />
            </div>
          ) : null}
          {actions.offersProductsNow ? (
            <div>
              <Button variant="secondary" on="canvas" icon={Search} onClick={actions.askForProducts}>
                {CHAT.productsNow}
              </Button>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        {notices ? (
          <div
            ref={attachNotices}
            role={noticesScrolls ? "region" : undefined}
            aria-label={noticesScrolls ? CHAT.notices : undefined}
            tabIndex={noticesScrolls ? 0 : undefined}
            className={classes.notices}
          >
            {error ? (
              <ErrorNotice
                error={error}
                where="chat"
                sessionId={session.id}
                onRetry={() => {
                  actions.retry();
                  // The button goes with the error; keep focus where the buyer types next.
                  focusComposer();
                }}
              />
            ) : null}
            {actions.unanswered ? (
              <Banner tone="info" action={{ label: CHAT.sendAgain, onClick: actions.sendAgain }}>
                {CHAT.noReply}
              </Banner>
            ) : null}
          </div>
        ) : null}

        <div
          className={classes.composer}
          onFocus={() => {
            // Keep a desktop dock's newest lines in view while typing.
            const box = boxRef.current;
            if (box) requestAnimationFrame(() => (box.scrollTop = box.scrollHeight));
          }}
        >
          <IntentInput
            label={composerLabel(ws.view)}
            submitLabel={COMPOSER.submit}
            placeholder={composerPlaceholder(questionOpen)}
            value={draft}
            onValueChange={setDraft}
            busy={busy}
            busyLabel={THINKING_LABEL}
            blurOnSubmit={blurOnSubmit}
            inputRef={composerRef}
            onSubmit={(text) => (questionOpen ? actions.answer(text, null) : ws.send(text))}
          />
        </div>
      </section>
      {/* The bar follows the section, outside it: a screen reader hears the
          chat and its composer, then the views. */}
      {bottomBar}
    </div>
  );
}
