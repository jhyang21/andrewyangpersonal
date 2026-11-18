"use client";

import { BASE } from "@/pica/lib/base";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, Card } from "@/pica/components/kit";
import { sessionReducer, type CanvasEdit } from "@/pica/lib/session";
import type { CatalogProduct, DecisionSession, DecisionStatus, ShortlistEntry } from "@/pica/lib/types";
import {
  DecisionMenu,
  DeclineReasons,
  EndDecisionSheet,
  ErrorNoticeView,
  ErrorStateView,
  EvidenceSheetView,
  CanvasItemEditor,
  editButtonId,
  placeFocusAfterRemove,
  JourneyPath,
  ReturnCheckView,
  StaleBanner,
  StorageNoticeView,
} from "@/pica/features/parts";
import { HeaderView, MenuSlot } from "@/pica/features/shell/HeaderView";
import { SEED_ID, seedDecision } from "../seed/fixture";

/**
 * Every shared part in every state, on the seed decision, for browser checks.
 * It uses the parts' `View`s and local state only: nothing here sends
 * analytics or writes the session store.
 */

// A fixed time, so the server and the browser draw the same page.
const SEED = seedDecision(Date.UTC(2026, 10, 17, 14, 0));
const ENTRIES = SEED.shortlist!.entries;
const [COMMUTER, , SLIM, TRAVEL] = ENTRIES.map((entry) => SEED.products[entry.productId]);
const entryOf = (product: CatalogProduct) => ENTRIES.find((entry) => entry.productId === product.id) ?? null;

const withStatus = (status: DecisionStatus, productId?: string): DecisionSession => ({
  ...SEED,
  decision: { status, productId },
});
const NO_NEEDS: DecisionSession = {
  ...SEED,
  canvas: { ...SEED.canvas, items: SEED.canvas.items.filter((item) => item.kind === "open_question") },
};
const NEW_DECISION: DecisionSession = { ...SEED, canvas: { ...SEED.canvas, items: [] }, shortlist: null, comparison: null };
const STALE: DecisionSession = { ...SEED, shortlist: { ...SEED.shortlist!, stale: true } };

/** A product with nothing said for it, to show each empty line. */
const BARE: CatalogProduct = {
  ...SLIM,
  descriptionText: "",
  summarized: { sellingPoints: [], features: [], specs: [] },
};
const BARE_ENTRY: ShortlistEntry = { ...entryOf(SLIM)!, unverified: [] };
/** Few reviews and a listing link, off the shortlist: no Pica's read. */
const TRAVEL_LISTED: CatalogProduct = {
  ...TRAVEL,
  variants: TRAVEL.variants.map((variant) => ({ ...variant, url: "https://north-trail.example/travel-pack" })),
};

const EVIDENCE_CASES = [
  { key: "full", label: "On the shortlist, every source", product: COMMUTER, entry: entryOf(COMMUTER) },
  { key: "bare", label: "Nothing said: each empty line", product: BARE, entry: BARE_ENTRY },
  { key: "off", label: "Off the shortlist, few reviews", product: TRAVEL_LISTED, entry: null },
] as const;

// A server line from the brief (section 7). Some server lines say "we"; the
// kit copy test bans that word in this folder, so this page shows one that does not.
const PICA_DOWN = "Pica can't reply right now. Try sending your message again in a moment.";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-4 flex-col gap-3">
      <h2 id={`${id}-title`} className="px-1 text-heading font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-caption text-ink-soft">{children}</p>;
}

/** A part on a white card, with a line saying which state it shows. */
function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card padding="md" className="flex min-w-0 flex-col gap-3">
      <Label>{label}</Label>
      {children}
    </Card>
  );
}

/** Shows what a handler would have done, since nothing here is sent. */
function useLog() {
  const [line, setLine] = useState("Nothing pressed yet.");
  const log = (text: string) => () => setLine(text);
  const view = (
    <p role="status" className="text-caption text-ink-soft">
      {line}
    </p>
  );
  return { log, view };
}

function HeaderStates() {
  const { log, view } = useLog();
  const menu = (session: DecisionSession, defaultOpen = false) => (
    <DecisionMenu
      session={session}
      defaultOpen={defaultOpen}
      onSave={log("Save for later: the screen saves, then goes to Done.")}
      onEnd={log("End without buying, confirmed: the screen ends it, then goes to Done.")}
    />
  );
  return (
    <div className="flex flex-col gap-3">
      <State label="Outside a decision">
        <HeaderView />
      </State>
      <State label="In the workspace with needs: the menu, at every width. The page's own heading carries the title.">
        <HeaderView menu={<MenuSlot>{menu(SEED)}</MenuSlot>} />
      </State>
      <State label="In the workspace with no needs yet, on Decide or Done, or while the store loads: no menu, its place held so Browse and Saved do not move.">
        <HeaderView menu={<MenuSlot>{menu(NO_NEEDS)}</MenuSlot>} />
      </State>
      <State label="Menu open in the workspace, decision open: both actions. End asks first.">
        <div className="flex justify-end pb-40">{menu(SEED, true)}</div>
      </State>
      <State label="Menu open in the workspace, decision saved: End without buying only">
        <div className="flex justify-end pb-24">{menu(withStatus("saved"), true)}</div>
      </State>
      {view}
    </div>
  );
}

function PathStates() {
  const commuterId = COMMUTER.id;
  const cases: { label: string; session: DecisionSession; current: "needs" | "options" | "compare" | "decide" | null; chosen?: string }[] = [
    { label: "A new decision, on Needs", session: NEW_DECISION, current: "needs" },
    { label: "Options on screen, nothing chosen", session: SEED, current: "options" },
    { label: "Compare on screen", session: SEED, current: "compare" },
    { label: "Decide, an option chosen, still open: Chosen", session: SEED, current: "decide", chosen: commuterId },
    { label: "Bought (Done: no current stage)", session: withStatus("bought", commuterId), current: null },
    { label: "Not buying", session: withStatus("declined"), current: null },
    { label: "Saved", session: withStatus("saved"), current: "needs" },
  ];
  return (
    <div className="flex flex-col gap-3">
      {cases.map((item) => (
        <State key={item.label} label={item.label}>
          <JourneyPath session={item.session} current={item.current} chosenProductId={item.chosen} />
        </State>
      ))}
    </div>
  );
}

function EvidenceStates() {
  const [open, setOpen] = useState<(typeof EVIDENCE_CASES)[number]["key"] | null>(null);
  const { log, view } = useLog();
  const shown = EVIDENCE_CASES.find((item) => item.key === open);
  return (
    <State label="Opens the sheet in each state">
      <div className="flex flex-wrap gap-2">
        {EVIDENCE_CASES.map((item) => (
          <Button key={item.key} aria-haspopup="dialog" onClick={() => setOpen(item.key)}>
            {item.label}
          </Button>
        ))}
      </div>
      <EvidenceSheetView
        product={shown?.product ?? null}
        entry={shown?.entry ?? null}
        onClose={() => setOpen(null)}
        onReviewLink={(site) => log(`Opened the ${site} search.`)()}
      />
      {view}
    </State>
  );
}

function EndStates() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>("not_now");
  const { log, view } = useLog();
  return (
    <div className="flex flex-col gap-3">
      <State label="End this decision: asks once, two buttons of one size">
        <div>
          <Button aria-haspopup="dialog" aria-controls="parts-end" onClick={() => setOpen(true)}>
            End without buying
          </Button>
        </div>
        <EndDecisionSheet
          id="parts-end"
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={() => {
            setOpen(false);
            log("Confirmed: the screen ends the decision.")();
          }}
        />
        {view}
      </State>
      <State label="Reasons, on Done for Not buying only. Tap the chosen one again to clear it.">
        <DeclineReasons current={reason} onPick={(code) => setReason((was) => (was === code ? undefined : code))} />
      </State>
    </div>
  );
}

function ReturnStates() {
  const { log, view } = useLog();
  return (
    <div className="flex flex-col gap-3">
      <ReturnCheckView
        merchant={COMMUTER.seller.name}
        productTitle={COMMUTER.title}
        onBought={log("Yes: records the purchase once, then Done.")}
        onNotYet={log("Not yet: the question goes away until the next checkout.")}
        headingLevel="h3"
      />
      <Label>The product is gone from the session:</Label>
      <ReturnCheckView merchant={null} productTitle={null} onBought={log("Yes")} onNotYet={log("Not yet")} headingLevel="h3" />
      {view}
    </div>
  );
}

function NoticeStates() {
  const { log, view } = useLog();
  return (
    <div className="flex flex-col gap-3">
      <Label>Critical, with Try again: a fault that may clear</Label>
      <ErrorNoticeView error={{ code: "model_unavailable", message: PICA_DOWN }} onRetry={log("Try again")} />
      <Label>Critical, no retry: trying again would not help</Label>
      <ErrorNoticeView
        error={{ code: "not_found", message: "That product isn't in the catalog any more." }}
        onRetry={log("Never shown")}
      />
      <Label>Caution, with Try again: a wait</Label>
      <ErrorNoticeView
        error={{
          code: "rate_limited",
          message: "You've sent a lot of messages in a short time. Wait a few minutes, then try again.",
        }}
        onRetry={log("Try again")}
      />
      <Label>Whole panel</Label>
      <Card padding="md">
        <ErrorStateView
          title="This decision isn't in this browser"
          description="It may have been made on another device, or cleared. Start a new one, or look in Saved."
          action={{ label: "Go to Saved", href: `${BASE}/saved` }}
          headingLevel="h3"
        />
      </Card>
      <Label>Needs changed after the options came; then the same while Pica replies</Label>
      <StaleBanner session={STALE} busy={false} onSend={(text) => log(`Sent: ${text}`)()} />
      <StaleBanner session={STALE} busy onSend={() => undefined} />
      <Label>Storage blocked; then storage full</Label>
      <StorageNoticeView problem="blocked" />
      <StorageNoticeView problem="full" />
      {view}
    </div>
  );
}

const NEEDS_SCOPE = "parts-needs";
const NEEDS_HEADING = "parts-needs-heading";

function EditorStates() {
  const [session, setSession] = useState(SEED);
  const [locked, setLocked] = useState(false);
  const { log, view } = useLog();
  const onEdit = (edit: CanvasEdit) => {
    const next = sessionReducer(session, { type: "canvas_edited", edit, at: session.updatedAt + 1 });
    if (next === session) return false;
    setSession(next);
    log(`Applied ${edit.kind}. On a screen, ws.editCanvas sends requirement_edited.`)();
    return true;
  };
  const [showForm, setShowForm] = useState(false);
  const needs = session.canvas.items.filter((item) => item.kind !== "open_question");
  const ids = needs.map((item) => item.id);
  // After Remove the row is gone, so the list moves focus: the next row's
  // Edit button, else the one before, else the heading.
  const focusAfter = (removedId: string) => () =>
    placeFocusAfterRemove({ scope: NEEDS_SCOPE, ids, removedId, headingId: NEEDS_HEADING });
  return (
    <State label="The seed's needs: stated, and one guess to confirm. Confirm keeps focus on the row's Edit; Remove moves it to the next row, or the heading once none are left.">
      <h3 id={NEEDS_HEADING} tabIndex={-1} className="px-1 text-body font-semibold">
        Your needs
      </h3>
      <fieldset disabled={locked} className="flex min-w-0 flex-col">
        <legend className="sr-only">Needs</legend>
        {needs.length === 0 ? <p className="px-1 text-body text-ink-soft">No needs left.</p> : null}
        <ul className="flex flex-col divide-y divide-hairline">
          {needs.map((item) => (
            <li key={item.id} className="py-2">
              <CanvasItemEditor
                item={item}
                onEdit={onEdit}
                locked={locked}
                editButtonId={editButtonId(NEEDS_SCOPE, item.id)}
                onRemoved={focusAfter(item.id)}
              />
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button pressed={locked} onClick={() => setLocked((was) => !was)}>
          Lock while Pica replies
        </Button>
        <Button onClick={() => setSession(SEED)}>Reset the needs</Button>
      </div>
      <Label>Opened as a form, as when Edit on a confirm card opens a need. The field takes focus, so it opens on a press:</Label>
      <div>
        <Button pressed={showForm} onClick={() => setShowForm((was) => !was)}>
          Show a need opened as a form
        </Button>
      </div>
      {showForm ? <CanvasItemEditor item={SEED.canvas.items[2]} onEdit={() => true} defaultEditing /> : null}
      {view}
    </State>
  );
}

export function PartsPreview() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-2 px-1">
        <h1 className="text-display font-semibold">Shared parts</h1>
        <p className="max-w-prose text-body-lg">
          The parts more than one screen uses, in every state, on the seed decision. Nothing here sends analytics or
          saves anything.
        </p>
        <p className="max-w-prose text-body text-ink-soft">
          To see the header on a real decision, open <Link className="underline underline-offset-4" href={`${BASE}/kit/seed`}>/kit/seed</Link>,
          then the decision <code>{SEED_ID}</code>.
        </p>
      </header>
      <Section id="parts-header" title="Header">
        <HeaderStates />
      </Section>
      <Section id="parts-path" title="Journey path">
        <PathStates />
      </Section>
      <Section id="parts-evidence-section" title="Evidence sheet">
        <EvidenceStates />
      </Section>
      <Section id="parts-end-section" title="Ending a decision">
        <EndStates />
      </Section>
      <Section id="parts-return" title="Did you buy it?">
        <ReturnStates />
      </Section>
      <Section id="parts-notices" title="Notices">
        <NoticeStates />
      </Section>
      <Section id="parts-needs" title="Need editor">
        <EditorStates />
      </Section>
    </main>
  );
}
