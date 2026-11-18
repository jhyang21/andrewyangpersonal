"use client";

import { BASE } from "@/pica/lib/base";
import { LayoutList, MessageCircle, Table } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { Banner, Button, Sheet, Skeleton, SummaryStrip, cn } from "@/pica/components/kit";
import { PicaLiveRegion } from "@/pica/components/mascot";
import { DemoBar } from "@/pica/features/demo/DemoBar";
import { EVIDENCE_SHEET_ID, ErrorState, EvidenceSheet, JourneyPath, ReturnCheck, StorageNotice } from "@/pica/features/parts";
import { useSession } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { stageForView } from "@/pica/features/shared/journey";
import { useMediaQuery } from "@/pica/features/shared/useMediaQuery";
import { CanvasPanel, type OpenRequest } from "./CanvasPanel";
import { CANVAS } from "./canvas-panel-model";
import { ChatPanel } from "./ChatPanel";
import {
  barEntries,
  closedBanner,
  DESKTOP_QUERY,
  PHONE_FIXED,
  summaryInput,
  takeLoadOpen,
  viewHref,
  viewStep,
} from "./frame-model";
import { opensCanvas, parseView, type WorkspaceView } from "./views";
import { useWorkspace } from "./useWorkspace";
import { CompareStage } from "./CompareStage";
import { OptionsStage } from "./OptionsStage";
import type { StageWorkspace } from "./stage-workspace";

export const FRAME = {
  loading: "Loading your decision",
  notFoundHeading: "Decision not found",
  notFoundTitle: "This decision isn't in this browser",
  notFoundBody:
    "Decisions live only in the browser where you started them, and this one isn't here. It may have been removed, or started on another device.",
  startNew: "Start a new decision",
  saved: "View saved decisions",
  bar: "Views",
} as const;

const NEEDS_SHEET_ID = "needs-sheet";
const BAR_ICONS = { chat: MessageCircle, options: LayoutList, compare: Table } as const;

export function WorkspaceScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ready, session } = useSession(id);

  if (!ready) return <WorkspaceLoading />;
  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8">
        <h1 className="sr-only">{FRAME.notFoundHeading}</h1>
        <ErrorState
          code="session_not_found"
          where="workspace"
          title={FRAME.notFoundTitle}
          description={FRAME.notFoundBody}
          action={{ label: FRAME.startNew, href: BASE }}
        />
        <div className="flex justify-center">
          <Button variant="ghost" href={`${BASE}/saved`}>
            {FRAME.saved}
          </Button>
        </div>
      </main>
    );
  }
  return <Workspace key={id} session={session} />;
}

/** The frame's shape in grey while the decision loads from this browser. */
export function WorkspaceLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 px-4 py-4 lg:max-w-none" aria-busy="true">
      <h1 className="sr-only">{FRAME.loading}</h1>
      <Skeleton variant="text" lines={2} />
      <Skeleton className="h-12 rounded-pill" />
      <Skeleton className="h-64" />
    </main>
  );
}

/**
 * Options and Compare. Both stay mounted, so a stage keeps its place when the
 * buyer switches views; `active` says which one is on screen.
 */
function Stages({ ws, view, isDesktop }: { ws: StageWorkspace; view: WorkspaceView; isDesktop: boolean }) {
  // Desktop Chat shows Options beside the chat.
  const optionsActive = view === "options" || (view === "chat" && isDesktop);
  return (
    <>
      <div hidden={view === "compare"}>
        <OptionsStage ws={ws} active={optionsActive} evidenceSheetId={EVIDENCE_SHEET_ID} />
      </div>
      <div hidden={view !== "compare"}>
        <CompareStage ws={ws} active={view === "compare"} evidenceSheetId={EVIDENCE_SHEET_ID} />
      </div>
    </>
  );
}

/**
 * The decision workspace's frame (brief 5, 6.2, 6.10). One h1, the journey
 * path, then three views: Chat, Options and Compare, picked by `?view=`.
 *
 * - Phone: the bottom bar switches views. The summary strip stays in view
 *   and opens the needs as a sheet. Over Options and Compare the chat docks
 *   above the composer with the last exchange.
 * - 1024px and up: the chat is a 360px column beside the stage; the strip
 *   sits over the stage and opens the needs as a sheet, as on a phone.
 * - Compare, at every width: the chat docks.
 *
 * The chat is mounted once, so the thinking row, an error and the live
 * announcement each show in one place. Sending never changes the view.
 */
function Workspace({ session }: { session: DecisionSession }) {
  const router = useRouter();
  const address = useSearchParams().get("view");
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const ws = useWorkspace(session, { initialView: parseView(address) });
  const view = ws.view;

  // The needs sheet, over whatever view shows; opening it never changes the
  // view or the address. The path's Needs, the strip and the chat's links open it.
  const [needsOpen, setNeedsOpen] = useState(false);
  // "Edit" on a confirm card: the need whose form opens.
  const [openItem, setOpenItem] = useState<OpenRequest | null>(null);
  // Bumped by "Go to chat" in an empty stage: the composer takes focus once Chat shows.
  const [composerFocus, setComposerFocus] = useState(0);

  // A load of `?view=canvas` opens the sheet over Chat, once. Opened from an
  // effect, so the sheet is never mounted open: under strict mode's mount,
  // unmount and mount, the dialog's own clean-up would close it at once.
  const loadOpen = useRef(opensCanvas(address));
  useEffect(() => {
    if (takeLoadOpen(loadOpen)) setNeedsOpen(true);
  }, []);

  // Follow `?view=`. Links to the same page do not remount the screen, so
  // compare the value with the last one seen on each render. `?view=canvas`
  // arrives here only by the browser's back and forward; the path's Needs
  // opens the sheet without touching the address.
  const [seen, setSeen] = useState(address);
  const step = viewStep(seen, address);
  if (step) {
    setSeen(address);
    setOpenItem(null);
    if (step.kind === "show") {
      setNeedsOpen(false);
      ws.show(step.view);
    } else {
      ws.show("chat");
      setNeedsOpen(true);
    }
  }

  function go(target: WorkspaceView) {
    router.push(viewHref(session.id, target), { scroll: false });
  }

  function openNeeds(itemId?: string) {
    if (itemId) setOpenItem((last) => ({ id: itemId, n: (last?.n ?? 0) + 1 }));
    setNeedsOpen(true);
  }

  // The sheet hands focus back to what had it when it opened. Opened on load,
  // nothing had focus, so it goes to the strip. Runs after the sheet's own
  // clean-up, as a parent's effects follow a child's.
  const was = useRef(needsOpen);
  useEffect(() => {
    const closed = was.current && !needsOpen;
    was.current = needsOpen;
    if (!closed) return;
    const active = document.activeElement;
    const lost = !active || active === document.body || active.getClientRects().length === 0;
    if (lost) document.querySelector<HTMLElement>(`[aria-controls="${NEEDS_SHEET_ID}"]`)?.focus();
  }, [needsOpen]);

  function closeSheet() {
    setNeedsOpen(false);
    setOpenItem(null);
    if (opensCanvas(address)) {
      // Opened by `?view=canvas`: Chat is under the sheet, so the address follows.
      setSeen("chat");
      router.replace(viewHref(session.id, "chat"), { scroll: false });
    }
  }

  const compare = view === "compare";
  const closed = closedBanner(session.decision.status);
  const needsProps = { canvas: session.canvas, locked: ws.busy, onEdit: ws.editCanvas };

  return (
    <main
      // Chat and Options fit the screen on desktop: the chat column and the
      // stage each scroll inside, so a long thread never lengthens the page.
      // Compare scrolls as a page, under its docked chat.
      data-fit={compare ? undefined : ""}
      className="mx-auto flex w-full min-h-0 max-w-[720px] flex-1 flex-col gap-4 px-4 pt-2 lg:max-w-none lg:px-6 lg:pb-6"
    >
      <div className="flex flex-col gap-3">
        <h1 className="break-words text-heading font-semibold text-ink">{session.title}</h1>
        <JourneyPath
          session={session}
          current={stageForView(view)}
          onNeeds={(link) => {
            // Safari does not focus a clicked link; the sheet hands focus back to it.
            link.focus();
            openNeeds();
          }}
        />
      </div>

      {session.demo ? (
        <DemoBar messages={ws.messages} busy={ws.busy} send={ws.send} go={go} className="lg:sticky lg:top-2" />
      ) : null}
      <StorageNotice />
      <ReturnCheck session={session} />
      {closed ? (
        <Banner
          title={closed.title}
          action={
            closed.action.reopen
              ? { label: closed.action.label, onClick: ws.reopen }
              : { label: closed.action.label, href: closed.action.href }
          }
        >
          {closed.body}
        </Banner>
      ) : null}

      {/* No box on a phone: the dock then sticks within the whole page, not
          this block, so at the top of the page it still reaches the foot of the screen. */}
      <div
        className={cn(
          "flex flex-1 flex-col gap-6 max-lg:contents",
          !compare &&
            // The 24rem floor keeps a very short window usable: the page scrolls instead.
            "lg:grid lg:min-h-[24rem] lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:items-start",
        )}
      >
        <SummaryStrip
          {...summaryInput(session.canvas)}
          onOpen={() => setNeedsOpen(true)}
          expanded={needsOpen}
          controls={NEEDS_SHEET_ID}
          // The frame mounts once the decision has loaded, so its first render is the load.
          announce
          className={cn(PHONE_FIXED.strip, !compare && "lg:col-start-2 lg:row-start-1")}
        />

        <div
          className={cn(
            "min-w-0",
            view === "chat" && "max-lg:hidden",
            // Its own scroll; the padding keeps focus rings clear of the edge.
            // Relative, so screen-reader-only text (absolute) scrolls inside
            // it rather than stretching the page.
            !compare &&
              "lg:relative lg:col-start-2 lg:row-start-2 lg:-m-1 lg:self-stretch lg:overflow-y-auto lg:overscroll-contain lg:p-1",
          )}
        >
          {/* A stage changes the view through the address, as the bar does. */}
          <Stages
            ws={{
              ...ws,
              goToChat: () => {
                setComposerFocus((n) => n + 1);
                go("chat");
              },
            }}
            view={view}
            isDesktop={isDesktop}
          />
        </div>

        {/* The chat holds the phone's bottom bar, under its composer. */}
        <ChatPanel
          ws={ws}
          onOpenNeeds={openNeeds}
          blurOnSubmit={!isDesktop}
          composerFocus={composerFocus}
          bar={{
            label: FRAME.bar,
            items: barEntries(session, ws.picks.length).map((entry) => ({ ...entry, icon: BAR_ICONS[entry.id] })),
            current: view,
            hideWhileTyping: true,
          }}
        />
      </div>

      <Sheet
        id={NEEDS_SHEET_ID}
        open={needsOpen}
        onClose={closeSheet}
        title={CANVAS.title}
        description={CANVAS.line}
      >
        <CanvasPanel {...needsProps} scope="sheet" showHeading={false} openItem={openItem} />
      </Sheet>

      <EvidenceSheet
        id={EVIDENCE_SHEET_ID}
        sessionId={session.id}
        product={ws.evidence.product}
        entry={ws.evidence.entry}
        onClose={ws.closeEvidence}
      />
      <PicaLiveRegion text={ws.announcement} />
    </main>
  );
}
