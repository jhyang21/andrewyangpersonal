"use client";

import { BASE } from "@/pica/lib/base";
import {
  Backpack,
  Bookmark,
  Briefcase,
  Columns2,
  Heart,
  LayoutGrid,
  ListChecks,
  Luggage,
  MessageCircle,
  Search,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { MascotSheet, PICA_POSES, Pica, PicaAvatar, PicaThinking, type PicaPose } from "@/pica/components/mascot";
import {
  Banner,
  BottomBar,
  Button,
  Card,
  Chip,
  EVIDENCE_KINDS,
  EmptyState,
  EvidenceTag,
  IconButton,
  IntentInput,
  Price,
  ProductImage,
  ProductSummary,
  Rating,
  STAGES,
  SegmentedControl,
  Sheet,
  Skeleton,
  SkeletonCard,
  SourceTag,
  StagePath,
  SummaryStrip,
  TextArea,
  TextInput,
  contrastRatio,
  evidenceHeading,
  luminance,
  segmentPanelId,
  segmentTabId,
  type BottomBarItem,
  type StageId,
} from "@/pica/components/kit";
import type { CatalogImage } from "@/pica/lib/types";

const BACKPACK: CatalogImage = {
  url: "https://cdn.shopify.com/s/files/1/0664/7418/0792/files/PDP_Signature_SlimCommuterBackpack_black_01.jpg",
  alt: "Black slim commuter backpack, front view",
  width: 1000,
  height: 1000,
};

const BROKEN: CatalogImage = {
  url: "https://cdn.shopify.com/s/files/0/not-a-real-image.jpg",
  alt: "Grey weekender bag",
};

const usd = (amount: number) => ({ amount, currency: "USD" });

/** Token values, as in src/pica/styles.css. The contrast test checks they match. */
const HEX = {
  ink: "#000000",
  "ink-soft": "#666362",
  "ink-muted": "#787574",
  canvas: "#f2f4f5",
  surface: "#ffffff",
  "purple-soft": "#dbd1ff",
} as const;

const TEXT_TOKENS = ["ink", "ink-soft", "ink-muted"] as const;
const GROUNDS = ["canvas", "surface"] as const;

const MOTION = [
  { token: "--duration-fast", value: "120ms", use: "Hover, press, small fades" },
  { token: "--duration-base", value: "200ms", use: "Sheets, cards entering" },
  { token: "--duration-slow", value: "320ms", use: "The three “lands” moments" },
  { token: "--ease-out-soft", value: "cubic-bezier(0.2, 0.8, 0.2, 1)", use: "Most movement" },
  { token: "--ease-settle", value: "cubic-bezier(0.3, 1.3, 0.5, 1)", use: "Lands, with a slight overshoot" },
];

const HREFS: Record<StageId, string> = {
  needs: "#kit-wayfinding",
  options: "#kit-wayfinding",
  compare: "#kit-wayfinding",
  decide: "#kit-wayfinding",
};

type View = "chat" | "options" | "compare";

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-3">
      <h2 className="px-1 text-heading font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  // ink-soft passes on white and on the grey canvas (see Tokens).
  return <p className="text-caption text-ink-soft">{children}</p>;
}

/** Pica in a part's `art` slot. The part hides the slot, so the bird carries no name here. */
function MascotSlot({ size, pose }: { size: number; pose?: PicaPose }) {
  return <Pica pose={pose} size={size} label={null} />;
}

/** Steps through the poses, so the slide between two poses can be watched. */
function PoseChanger() {
  const [index, setIndex] = useState(0);
  const pose = PICA_POSES[index % PICA_POSES.length];
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Pica pose={pose} size={120} label={null} />
      <PicaAvatar pose={pose} size={40} />
      <PicaAvatar pose={pose} size={32} />
      <div className="flex flex-col items-start gap-2">
        <p className="text-body" aria-live="polite">
          Pose: <span className="font-semibold">{pose}</span>
        </p>
        <Button onClick={() => setIndex((i) => i + 1)}>Next pose</Button>
      </div>
    </div>
  );
}

/** The row that owns its announcement mounts on a press, so loading this page says nothing. */
function ThinkingDemo() {
  const [shown, setShown] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <Button pressed={shown} onClick={() => setShown((on) => !on)}>
          Show thinking
        </Button>
        {shown ? <PicaThinking /> : null}
      </div>
      <PicaThinking announce={false} />
    </>
  );
}

function Swatch({ fg, bg }: { fg: (typeof TEXT_TOKENS)[number]; bg: (typeof GROUNDS)[number] }) {
  const ratio = contrastRatio(HEX[fg], HEX[bg]);
  const pass = ratio >= 4.5;
  return (
    <div className={`flex flex-col gap-1 rounded-thumb border border-hairline p-3 ${bg === "canvas" ? "bg-canvas" : "bg-surface"}`}>
      <p className={`text-body font-semibold ${fg === "ink" ? "text-ink" : fg === "ink-soft" ? "text-ink-soft" : "text-ink-muted"}`}>
        {fg} on {bg}
      </p>
      <p className="text-caption text-ink">
        {ratio.toFixed(2)}:1 · {pass ? "passes for text" : "large text and edges only"}
      </p>
    </div>
  );
}

export function KitPreview() {
  const [chips, setChips] = useState({ commute: true, office: false, travel: false });
  const [tags, setTags] = useState(["Fits a 16-inch laptop", "Under $200", "Water resistant"]);
  const [saved, setSaved] = useState(false);
  const [lastIntent, setLastIntent] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<View>("options");
  const [loading, setLoading] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [needs, setNeeds] = useState(3);
  const [comparing, setComparing] = useState(2);
  const [stage, setStage] = useState<StageId | undefined>("options");
  const [compareOn, setCompareOn] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sendFails, setSendFails] = useState(true);
  const [sendNote, setSendNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<null | "loading" | "done">(null);
  const [plainOn, setPlainOn] = useState(false);
  const [slowSends, setSlowSends] = useState(0);

  // A send that takes 1.5 seconds. Pressing Enter again meanwhile does nothing.
  function slowSend() {
    setSlowSends((n) => n + 1);
    return new Promise<void>((resolve) => window.setTimeout(resolve, 1500));
  }

  function failableSend(text: string) {
    if (sendFails) {
      setSendNote("Couldn't send. Your text is still in the box.");
      return false;
    }
    setSendNote(`Sent: ${text}`);
  }

  // A screen that renders empty, then loads the decision. The strip stays
  // silent through the load and only announces changes after it.
  function loadDecision() {
    setLoaded("loading");
    window.setTimeout(() => setLoaded("done"), 1200);
  }

  function fakeLoad() {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 2000);
  }

  const softL = luminance(HEX["ink-soft"]);
  const canvasL = luminance(HEX.canvas);
  const softOnCanvas = contrastRatio(HEX["ink-soft"], HEX.canvas);

  const barItems: BottomBarItem[] = [
    { id: "chat", href: "#kit-wayfinding", label: "Chat", icon: MessageCircle },
    { id: "options", href: "#kit-wayfinding", label: "Options", icon: LayoutGrid, count: 4, countLabel: "4 options" },
    {
      id: "compare",
      href: "#kit-wayfinding",
      label: "Compare",
      icon: Columns2,
      count: comparing,
      countLabel: `${comparing} in the comparison`,
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-2 px-1">
        <h1 className="text-display font-semibold">Component kit</h1>
        <p className="max-w-prose text-body-lg">
          The parts the Pica pages are built from, in every state. Purple shows up more than once here only
          because this page lists every state. A real screen gets one purple button.
        </p>
        <p className="max-w-prose text-body text-ink-soft">
          Pica is drawn in its own folder. Where a part shows Pica, it takes it through a slot; the Pica
          section below shows every pose.
        </p>
      </header>

      <Section title="Tokens">
        <Card className="flex flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {TEXT_TOKENS.map((fg) => GROUNDS.map((bg) => <Swatch key={`${fg}-${bg}`} fg={fg} bg={bg} />))}
          </div>
          <div className="flex flex-col gap-1 text-body">
            <p className="font-semibold">ink-soft on canvas, worked out</p>
            <p className="break-words tabular-nums">
              Luminance of #666362 is {softL.toFixed(4)}; of #F2F4F5, {canvasL.toFixed(4)}.
            </p>
            <p className="break-words tabular-nums">
              ({canvasL.toFixed(4)} + 0.05) ÷ ({softL.toFixed(4)} + 0.05) = {(canvasL + 0.05).toFixed(4)} ÷{" "}
              {(softL + 0.05).toFixed(4)} = {softOnCanvas.toFixed(2)}:1, above the 4.5:1 floor.
            </p>
            <Label>Worked from the WCAG formula by the kit&rsquo;s contrast helper, the same one the tests use.</Label>
          </div>
        </Card>
        <Card className="flex flex-col gap-2">
          <p className="text-body font-semibold">Motion</p>
          <ul className="flex flex-col gap-2">
            {MOTION.map(({ token, value, use }) => (
              <li key={token} className="flex flex-col text-body sm:flex-row sm:gap-3">
                <code className="font-semibold break-all sm:w-40 sm:shrink-0">{token}</code>
                <span className="break-all tabular-nums sm:w-64 sm:shrink-0">{value}</span>
                <span className="text-ink-soft">{use}</span>
              </li>
            ))}
          </ul>
          <Label>Under reduced motion the three durations drop to 0ms and every animation stops.</Label>
        </Card>
      </Section>

      <Section title="Buttons">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={Search} onClick={fakeLoad} loading={loading}>
              Find backpacks
            </Button>
            <Button variant="primary" loading>
              Continue to checkout
            </Button>
            <Button variant="primary" disabled>
              Continue to checkout
            </Button>
            <Label>Primary: purple, 48 high, one per screen. Idle (press it to see loading), loading, disabled.</Label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button icon={Bookmark}>Save for later</Button>
            <Button>Compare</Button>
            <Button loading>Saving</Button>
            <Button disabled>Compare</Button>
            <Label>Secondary: grey, 44 high. Idle, loading, disabled.</Label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost">Skip this question</Button>
            <Button variant="ghost" href={BASE}>
              Go home
            </Button>
            <Button variant="ghost" href="https://shop.app">
              Open Shop
            </Button>
            <Button variant="ghost" disabled>
              Skip this question
            </Button>
            <Button variant="ghost" href={BASE} disabled>
              Go home
            </Button>
            <Label>Ghost, internal link, external link, then a disabled ghost and a disabled link.</Label>
          </div>
          <Button fullWidth>Keep looking</Button>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">Compare</Button>
            <Button variant="ghost" size="lg">
              Skip this question
            </Button>
            <Button variant="primary" size="md">
              Continue
            </Button>
            <Label>Size sets the height for any variant: secondary and ghost at 48 (lg), primary at 44 (md).</Label>
          </div>
        </Card>
        <Card className="flex flex-col gap-3">
          <p className="text-body font-semibold">Toggles and disclosures</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button icon={Columns2} pressed={compareOn} onClick={() => setCompareOn((on) => !on)}>
              Compare
            </Button>
            <Button icon={Columns2} pressed>
              Compare
            </Button>
            <Button icon={Columns2} pressed disabled>
              Compare
            </Button>
            <Label>
              A toggle (press it), pressed, and pressed but disabled. Pressed takes the fill, a check and a 2px ink
              edge, and screen readers hear &ldquo;pressed&rdquo;.
            </Label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button id="kit-plain-toggle" pressed={plainOn} onClick={() => setPlainOn((on) => !on)}>
              Compare
            </Button>
            <Button variant="ghost">Next to it</Button>
            <Label>
              A toggle with no icon keeps a check-sized space while unpressed, so pressing it does not move its
              neighbour.
            </Label>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Button
              variant="ghost"
              id="kit-more"
              aria-expanded={moreOpen}
              aria-controls="kit-more-panel"
              onClick={() => setMoreOpen((o) => !o)}
            >
              {moreOpen ? "Less" : "More"}
            </Button>
            <div id="kit-more-panel" hidden={!moreOpen} className="rounded-thumb bg-canvas px-3 py-2 text-body">
              Ships from Portland. Free returns within 30 days.
            </div>
            <Label>A disclosure: &ldquo;More&rdquo; sets aria-expanded and points at the panel it opens.</Label>
          </div>
          <div className="flex flex-col items-start gap-2">
            <IconButton
              icon={ListChecks}
              label="Menu"
              tone="canvas"
              id="kit-menu-button"
              aria-expanded={menuOpen}
              aria-controls="kit-menu"
              onClick={() => setMenuOpen((o) => !o)}
            />
            <ul id="kit-menu" hidden={!menuOpen} className="flex flex-col gap-1 rounded-thumb bg-canvas p-2 text-body">
              <li>Saved</li>
              <li>Past decisions</li>
            </ul>
            <Label>
              An icon button that opens a list, as in the header or on a Saved card. Add aria-haspopup when the list
              is a true menu with arrow keys.
            </Label>
          </div>
        </Card>
        <Card className="flex flex-col gap-3">
          <p className="text-body font-semibold">One height for a stack, as on Decide</p>
          <Button variant="primary" fullWidth>
            Go to Ridgeline Outfitters and Supply Company of Portland to pay
          </Button>
          <Button size="lg" fullWidth icon={Bookmark}>
            Save for later
          </Button>
          <Button variant="ghost" size="lg" fullWidth>
            End without buying
          </Button>
          <Label>
            Three buttons at 48. Full width takes a minimum height, so a long merchant name wraps inside the
            shape at 320px.
          </Label>
        </Card>
        <div className="flex flex-wrap items-center gap-3 px-1">
          <Button on="canvas" icon={Bookmark}>
            Save for later
          </Button>
          <Label>A secondary button on the grey canvas turns white.</Label>
        </div>
      </Section>

      <Section title="Icon buttons">
        <div className="flex flex-wrap items-center gap-3 px-1">
          <IconButton icon={Heart} label="Save backpack" tone="surface" pressed={saved} onClick={() => setSaved((s) => !s)} />
          <IconButton icon={X} label="Close" tone="surface" />
          <IconButton icon={X} label="Close" tone="canvas" />
          <IconButton icon={MessageCircle} label="Ask Pica" tone="ghost" />
          <IconButton icon={Search} label="Search" tone="surface" disabled />
          <IconButton icon={Search} label="Search" tone="canvas" disabled />
          <IconButton icon={MessageCircle} label="Ask Pica" tone="ghost" disabled />
          <Label>Surface (the heart toggles), canvas, ghost, then each disabled.</Label>
        </div>
      </Section>

      <Section title="Chips">
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Chip label="Commute" icon={Backpack} selected={chips.commute} onClick={() => setChips((c) => ({ ...c, commute: !c.commute }))} />
          <Chip label="Office" icon={Briefcase} selected={chips.office} onClick={() => setChips((c) => ({ ...c, office: !c.office }))} />
          <Chip label="Travel" icon={Luggage} selected={chips.travel} onClick={() => setChips((c) => ({ ...c, travel: !c.travel }))} />
          <Label>Toggles. Selected adds a check and a 2px ink edge to the fill.</Label>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Chip label="Unavailable" onClick={() => undefined} disabled />
          <Chip label="Picked" onClick={() => undefined} selected disabled />
          <Chip label="Removable" onRemove={() => undefined} disabled />
          <Label>Disabled: a toggle, a selected toggle and a removable chip.</Label>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Chip label="Under $200" onClick={() => undefined} />
          <Chip label="Something for travel" onClick={() => undefined} />
          <Label>One-shot chips for quick answers. They have no pressed state.</Label>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Chip
            label="A backpack that fits a 16-inch laptop and a change of clothes for an overnight trip"
            onClick={() => undefined}
          />
          <Chip label="Water resistant enough for a bike commute in the rain" icon={Backpack} selected onClick={() => undefined} />
          <Chip label="Must have a separate padded sleeve for the laptop" onRemove={() => undefined} />
          <Label>Long labels wrap inside the chip, which turns to a rounded rectangle. Nothing is cut at 320px.</Label>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Chip label="Static label" />
          <Chip label="Leather" selected />
          <Label>Labels with no action. Screen readers hear &ldquo;Leather, selected&rdquo;.</Label>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-1">
          {tags.map((tag) => (
            <Chip key={tag} label={tag} onRemove={() => setTags((t) => t.filter((x) => x !== tag))} />
          ))}
          {tags.length === 0 ? (
            <Button variant="ghost" onClick={() => setTags(["Fits a 16-inch laptop", "Under $200", "Water resistant"])}>
              Bring back the chips
            </Button>
          ) : null}
        </div>
      </Section>

      <Section title="Inside a disabled fieldset">
        <fieldset disabled className="flex flex-wrap items-center gap-3 px-1">
          <Button variant="primary">Continue to checkout</Button>
          <Button>Compare</Button>
          <Button variant="ghost">Skip this question</Button>
          <IconButton icon={Heart} label="Save backpack" tone="surface" />
          <IconButton icon={MessageCircle} label="Ask Pica" tone="ghost" />
          <Chip label="Commute" icon={Backpack} selected onClick={() => undefined} />
          <Chip label="Under $200" onClick={() => undefined} />
          <Chip label="Water resistant" onRemove={() => undefined} />
          <Label>None of these has a disabled prop; the fieldset disables them.</Label>
        </fieldset>
      </Section>

      <Section title="Inputs">
        <Card className="grid gap-5 sm:grid-cols-2">
          <TextInput label="Budget" placeholder="Up to $200" inputMode="decimal" />
          <TextInput label="Laptop size" hint="Measure the screen corner to corner" placeholder="16 inches" />
          <TextInput label="Email" defaultValue="not an email" error="Add an email with an @, like you@example.com" />
          <TextInput label="Merchant" defaultValue="Set by the catalog" disabled />
          <TextArea
            label="Why aren't you buying?"
            hint="Optional. Pica uses it to do better next time."
            placeholder="Too pricey, or I want to wait for a sale"
            className="sm:col-span-2"
          />
        </Card>
        <div className="flex flex-col gap-3">
          <IntentInput onSubmit={setLastIntent} placeholder="A backpack for a 16-inch laptop" />
          <p className="px-1 text-body" aria-live="polite">
            {lastIntent ? `Sent: ${lastIntent}` : "Type and press Enter. Shift+Enter adds a line."}
          </p>
          <IntentInput onSubmit={() => undefined} busy defaultValue="Is expensive luggage worth it?" />
          <Label>Busy: the field still takes typing; only sending waits.</Label>
          <IntentInput
            onSubmit={() => setComposer("")}
            value={composer}
            onValueChange={setComposer}
            label="Ask Pica about these options"
            placeholder="Ask Pica about these options"
            error={composer.length > 40 ? "Keep it under 40 characters for this demo" : undefined}
            blurOnSubmit
          />
          <Label>Controlled, with a field error past 40 characters, and it gives up focus after a send.</Label>
          <IntentInput
            onSubmit={failableSend}
            label="Message that may fail to send"
            placeholder="Type, then send"
          />
          <div className="flex flex-wrap items-center gap-2 px-1">
            <Chip label="Sending fails" selected={sendFails} onClick={() => setSendFails((f) => !f)} />
            <p className="text-body" aria-live="polite">
              {sendNote ?? "With sending set to fail, onSubmit returns false and the text stays."}
            </p>
          </div>
          <IntentInput onSubmit={slowSend} label="Message that takes a moment to send" placeholder="Type, then press Enter twice" />
          <p className="px-1 text-body" aria-live="polite">
            {slowSends === 1 ? "Sent once." : `Sent ${slowSends} times.`} The send takes 1.5 seconds; a second Enter in
            that time is ignored, and typing still works.
          </p>
          <IntentInput onSubmit={() => undefined} disabled placeholder="Chat is closed for this decision" />
          <Label>Disabled.</Label>
        </div>
      </Section>

      <Section title="Segmented control">
        <div className="flex flex-col items-start gap-3">
          <SegmentedControl<View>
            id="kit-view"
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "chat", label: "Chat", icon: MessageCircle },
              { value: "options", label: "Options", icon: ListChecks },
              { value: "compare", label: "Compare", icon: Columns2 },
            ]}
          />
          {(["chat", "options", "compare"] as View[]).map((v) => (
            <div
              key={v}
              role="tabpanel"
              id={segmentPanelId("kit-view", v)}
              aria-labelledby={segmentTabId("kit-view", v)}
              hidden={view !== v}
              className="px-1 text-body"
            >
              The {v} view goes here. Arrow keys move between the tabs.
            </div>
          ))}
        </div>
      </Section>

      <Section title="Surfaces">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card padding="sm">
            <p className="text-body">Card, small padding</p>
          </Card>
          <Card>
            <p className="text-body">Card, default padding</p>
          </Card>
          <Card padding="lg" shadow>
            <p className="text-body">Card, large padding with shadow</p>
          </Card>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-1">
          <Button on="canvas" onClick={() => setSheetOpen(true)}>
            Review price
          </Button>
          <Label>Opens a sheet. Tab stays inside, Escape closes it, and focus comes back here.</Label>
        </div>
        <Sheet
          id="kit-sheet"
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Review price"
          description="Shipping and tax show at the merchant's checkout."
          footer={
            <Button variant="primary" fullWidth onClick={() => setSheetOpen(false)}>
              Continue to checkout
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <ProductSummary image={BACKPACK} name="Slim Commuter Backpack, black" merchant="Example Goods" price={usd(16800)} />
            <TextInput label="Quantity" type="number" min={1} defaultValue={1} />
            <Banner tone="caution">Price and stock were checked 12 minutes ago. Pica checks again before checkout.</Banner>
            <Banner tone="info">Shipping is set by the merchant.</Banner>
            <Banner tone="critical">This size sold out since Pica last checked.</Banner>
          </div>
        </Sheet>
      </Section>

      <Section title="Banners">
        <div className="flex flex-col gap-3">
          <Banner tone="info" title="Shopify's catalog isn't every store">
            These options come from shops on Shopify. Other stores may carry the same bag.
          </Banner>
          <Banner tone="caution" title="Your options are out of date" action={{ label: "Update options", onClick: () => undefined }}>
            You changed your budget after Pica found these.
          </Banner>
          <Banner tone="critical" title="Couldn't reach the catalog" action={{ label: "Try again", onClick: () => undefined }}>
            Pica couldn&rsquo;t load products. Your answers are saved.
          </Banner>
          <Banner tone="caution" art={<MascotSlot size={24} pose="unsure" />} action={{ label: "See the evidence", href: "#kit-trust" }}>
            Two of these claims are not verified by the merchant.
          </Banner>
          <Label>Info and caution are status lines; critical is an alert. The last one takes Pica in its art slot.</Label>
        </div>
        <Card className="flex flex-col gap-3">
          <Banner tone="info">Shopify&rsquo;s catalog isn&rsquo;t every store.</Banner>
          <Banner tone="caution">You changed your budget after Pica found these.</Banner>
          <Banner tone="critical">Pica couldn&rsquo;t load products.</Banner>
          <Label>On a white card: the 1px ink-muted edge keeps each banner in view. The Sheet shows all three too.</Label>
        </Card>
      </Section>

      <Section title="Pica">
        <Card className="flex flex-col gap-6">
          <Label>Every pose at 24, 48 and 120. In this table only the 48px thinking bird moves.</Label>
          {/* Three sizes side by side need 340px; on a narrow phone the sheet scrolls inside its card, not the page. */}
          <div className="overflow-x-auto" tabIndex={0} role="group" aria-label="Pica's poses">
            <MascotSheet />
          </div>
        </Card>
        <Card className="flex flex-col gap-4">
          <Label>A pose change slides; with reduced motion it jumps.</Label>
          <PoseChanger />
        </Card>
        <Card className="flex flex-col gap-4">
          <Label>Avatars, 40 in chat and 32 in the docked thread</Label>
          <div className="flex flex-wrap items-center gap-3">
            {PICA_POSES.map((pose) => (
              <PicaAvatar key={pose} pose={pose} size={40} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {PICA_POSES.map((pose) => (
              <PicaAvatar key={pose} pose={pose} size={32} />
            ))}
          </div>
        </Card>
        <Card className="flex flex-col gap-4">
          <Label>
            Thinking row. The one behind the button announces itself when it appears; the one below is silent, for
            a screen that speaks through its own live region.
          </Label>
          <ThinkingDemo />
        </Card>
      </Section>

      <Section title="Loading">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Skeleton variant="circle" className="size-10" />
            <Skeleton variant="text" lines={2} className="flex-1" />
          </div>
          <Skeleton className="h-32 w-full" />
        </Card>
        <Label>The pulse stops under reduced motion.</Label>
      </Section>

      <Section title="Empty states">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <EmptyState
              art={<MascotSlot size={120} />}
              title="No backpacks match yet"
              description="Nothing under $80 fits a 16-inch laptop. Raise the budget or drop the laptop size."
              action={<Button>Change budget</Button>}
            />
          </Card>
          <Card>
            <EmptyState
              title="Nothing saved yet"
              description="Decisions you save for later show here."
              action={<Button href={BASE}>Start a new search</Button>}
            />
          </Card>
        </div>
        <Label>With Pica in the art slot, and with no art.</Label>
      </Section>

      <Section title="Commerce">
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-4">
          <Card as="article" padding="sm" className="flex flex-col gap-2">
            <ProductImage image={BACKPACK} alt="Slim Commuter Backpack" eager />
            <div className="flex flex-col gap-1 px-1">
              <p className="text-body font-semibold">Slim Commuter Backpack</p>
              <Rating rating={{ value: 4.62, count: 212, scaleMax: 5 }} />
              <Price price={usd(16800)} otherVersions={{ min: usd(16800), max: usd(22800) }} />
            </div>
          </Card>
          <Card as="article" padding="sm" className="flex flex-col gap-2">
            <ProductImage image={null} alt="Canvas tote" />
            <div className="flex flex-col gap-1 px-1">
              <p className="text-body font-semibold">Canvas tote</p>
              <Rating rating={undefined} />
              <Price price={usd(4500)} max={usd(6999)} />
              <Label>No photo, no rating, a price range</Label>
            </div>
          </Card>
          <Card as="article" padding="sm" className="flex flex-col gap-2">
            <ProductImage image={BROKEN} alt="Weekender" />
            <div className="flex flex-col gap-1 px-1">
              <p className="text-body font-semibold">Weekender</p>
              <Rating rating={{ value: 8.2, count: 1, scaleMax: 10 }} noteFewReviews />
              <Price price={{ amount: 2400000, currency: "JPY" }} />
              <Label>Broken photo, 10-point rating with one review, yen</Label>
            </div>
          </Card>
          <SkeletonCard />
        </div>
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-6">
            <Price price={usd(16800)} size="sm" />
            <Price price={usd(16800)} />
            <Price price={usd(16800)} size="lg" />
            <Label>Price at sm, md and lg. It has no struck-through form.</Label>
          </div>
          <ProductSummary image={BACKPACK} name="Slim Commuter Backpack" merchant="Example Goods" price={usd(16800)} />
          <ProductSummary
            image={null}
            name="Ridge Roll-Top Waterproof Commuter Backpack with Laptop Sleeve, 28 litres"
            merchant="A Store With a Fairly Long Name"
            price={usd(21950)}
            trailing={<IconButton icon={X} label="Remove Ridge Roll-Top backpack" tone="ghost" />}
          />
          <ProductSummary image={BACKPACK} name="Slim Commuter Backpack" merchant="Example Goods" price={usd(16800)} size="sm" />
          <Label>
            ProductSummary: default, a long name with no photo and a Remove button, and the small size. Text wraps;
            nothing is cut. With no photo the thumbnail stays silent to screen readers, since the name is right there.
          </Label>
        </Card>
      </Section>

      <Section id="kit-trust" title="Trust">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {EVIDENCE_KINDS.map((basis) => (
              <EvidenceTag key={basis} basis={basis} />
            ))}
          </div>
          <Label>The four evidence kinds. Not verified has a dashed edge. On the evidence sheet the listing&rsquo;s heading reads &ldquo;{evidenceHeading("catalog_summary")}&rdquo;.</Label>
          <div className="flex flex-col items-start gap-2">
            <EvidenceTag basis="merchant" onToggle={() => setQuoteOpen((o) => !o)} expanded={quoteOpen} controls="kit-quote" />
            <blockquote id="kit-quote" hidden={!quoteOpen} className="rounded-thumb bg-canvas px-3 py-2 text-body">
              &ldquo;Padded sleeve fits laptops up to 16 inches.&rdquo;
            </blockquote>
            <Label>As a button, it opens the quote behind the claim.</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            <SourceTag source="stated" />
            <SourceTag source="inferred" />
          </div>
          <Label>Where a need came from. A guess has a dashed edge until the buyer confirms it.</Label>
        </Card>
      </Section>

      <Section id="kit-wayfinding" title="Wayfinding">
        <Card className="flex flex-col gap-4">
          <StagePath counts={{ needs, options: 4, comparing }} hrefs={HREFS} current={stage} />
          <div className="flex flex-wrap items-center gap-2">
            {STAGES.map(({ id, label }) => (
              <Chip key={id} label={label} selected={stage === id} onClick={() => setStage((s) => (s === id ? undefined : id))} />
            ))}
            <Label>Pick the current stage, or none.</Label>
          </div>
          <StagePath counts={{ needs: 0, options: 0, comparing: 0 }} hrefs={HREFS} current="needs" />
          <StagePath counts={{ needs: 3, options: 4, comparing: 2, outcome: "Bought" }} hrefs={HREFS} current="decide" />
          <Label>
            Empty, then ended with &ldquo;Bought&rdquo;. On a phone only the current stage shows its fact; screen readers
            still hear every stage&rsquo;s fact.
          </Label>
        </Card>
        <div className="flex flex-col gap-3">
          <SummaryStrip
            category="Backpacks"
            budget="under $200"
            needs={needs}
            toConfirm={1}
            onOpen={() => setSheetOpen(true)}
            expanded={sheetOpen}
            controls="kit-sheet"
          />
          <SummaryStrip needs={0} toConfirm={0} onOpen={() => setSheetOpen(true)} expanded={sheetOpen} controls="kit-sheet" />
          <Label>Both strips point at the Sheet&rsquo;s id. The dialog stays mounted while closed, so the id is always there.</Label>
          <SummaryStrip
            category={loaded === "done" ? "Backpacks" : null}
            budget={loaded === "done" ? "under $200" : null}
            needs={loaded === "done" ? needs : 0}
            toConfirm={loaded === "done" ? 1 : 0}
            announce={loaded === "done"}
            onOpen={() => setSheetOpen(true)}
            expanded={sheetOpen}
            controls="kit-sheet"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button on="canvas" loading={loaded === "loading"} disabled={loaded === "done"} onClick={loadDecision}>
              Load the decision
            </Button>
            <Button variant="ghost" disabled={loaded === null} onClick={() => setLoaded(null)}>
              Start empty again
            </Button>
          </div>
          <Label>
            A screen that renders empty, then loads. Announce is off while loading and turns on in the same render
            that brings the data, so the load is silent and still. The next change, such as Add a need, is heard
            and lifts.
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Button on="canvas" onClick={() => setNeeds((n) => n + 1)}>
              Add a need
            </Button>
            <Button variant="ghost" disabled={needs === 0} onClick={() => setNeeds((n) => Math.max(0, n - 1))}>
              Remove a need
            </Button>
            <Button on="canvas" onClick={() => setComparing((n) => n + 1)}>
              Add to comparison
            </Button>
            <Button variant="ghost" disabled={comparing === 0} onClick={() => setComparing((n) => Math.max(0, n - 1))}>
              Take one out
            </Button>
          </div>
          <Label>
            Change a count to see it land: the strip lifts once, the stage counts and the Compare count settle.
            Nothing moves under reduced motion.
          </Label>
        </div>
        <div className="flex flex-col gap-3">
          <BottomBar items={barItems} current="options" />
          <BottomBar
            items={barItems.map((item) => ({ ...item, count: 0 }))}
            current="chat"
            label="Views, before any options"
          />
          <Label>The phone&rsquo;s bottom bar: links, not tabs. Counts show once a view holds something.</Label>
        </div>
      </Section>
    </main>
  );
}
