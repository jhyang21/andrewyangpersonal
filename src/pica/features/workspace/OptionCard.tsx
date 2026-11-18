"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Card, EvidenceTag, Price, ProductImage, Rating, cn } from "@/pica/components/kit";
import type { CatalogProduct, ShortlistEntry } from "@/pica/lib/types";
import { CheckedLine, type Freshness } from "@/pica/features/shared/freshness";
import { productImage } from "@/pica/features/shared/format";
import { OPTIONS_STAGE, canChoose, cardLines, cardStockText, domKey, moreLines, type PickControl } from "./options-stage-model";
import { decideHref, priceLine } from "./shortlist-model";

export interface OptionCardProps {
  sessionId: string;
  entry: ShortlistEntry;
  product: CatalogProduct;
  /** The Compare box's state, from `pickControl`. */
  pick: PickControl;
  onTogglePick: () => void;
  onEvidence: () => void;
  /** The evidence sheet's id, for `aria-controls`, where the page has that sheet. */
  evidenceSheetId?: string;
  freshness: Freshness;
  today: number | null;
  /** Load the photo now: the first card on screen. */
  eager?: boolean;
}

/**
 * A labelled line of Pica's: "Why it fits you" or "Why you might not want it".
 * Same size and weight for both. No tag: the stage says once, above the
 * cards, that the reasons are Pica's read.
 */
function Reason({ label, lines, extraId, open }: { label: string; lines: [string, ...string[]]; extraId: string; open: boolean }) {
  const [first, ...rest] = lines;
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-body font-semibold text-ink">{label}</h4>
      <p className="break-words text-body-lg text-ink">{first}</p>
      {rest.length > 0 ? (
        <ul id={extraId} hidden={!open} className="flex list-disc flex-col gap-1 pl-5 text-body-lg text-ink">
          {rest.map((line, i) => (
            <li key={`${i}-${line}`} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MoreBlock({ title, tag, children }: { title: string; tag?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h4 className="text-body font-semibold text-ink">{title}</h4>
        {tag}
      </div>
      {children}
    </div>
  );
}

const TEXT_LINK =
  "inline-flex min-h-11 items-center gap-1 rounded-pill px-3 text-body font-medium text-ink underline underline-offset-4 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * One option, closed: photo with a Compare box in its corner, the angle,
 * name, merchant, price, rating and stock, one reason it fits and one
 * drawback. Under them, "More" and "See the evidence" as plain text, and one
 * button: "Choose this one". The time a price was checked shows only when it
 * may be out of date. No card is larger, ranked or badged.
 */
export function OptionCard({
  sessionId,
  entry,
  product,
  pick,
  onTogglePick,
  onEvidence,
  evidenceSheetId,
  freshness,
  today,
  eager = false,
}: OptionCardProps) {
  const [open, setOpen] = useState(false);
  const key = domKey(product.id);
  const nameId = `option-${key}-name`;
  const ids = { fits: `option-${key}-fits`, whyNot: `option-${key}-whynot`, more: `option-${key}-more` };
  const lines = cardLines(entry);
  const more = moreLines(entry);
  const price = priceLine(product);
  const choosable = canChoose(product);
  const controls = [more.fits.length > 0 ? ids.fits : null, more.whyNot.length > 0 ? ids.whyNot : null, ids.more]
    .filter(Boolean)
    .join(" ");
  const name = <span className="sr-only">: {product.title}</span>;

  return (
    <Card as="article" padding="none" className="relative flex w-full min-w-0 flex-col overflow-hidden">
      <ProductImage image={productImage(product)} alt={product.title} eager={eager} className="w-full" />
      <label
        className={cn(
          "absolute right-2 top-2 inline-flex min-h-11 items-center gap-2 rounded-pill bg-surface px-3 text-body font-medium text-ink shadow-sm",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
          pick.disabled ? "text-ink-muted" : "cursor-pointer",
        )}
      >
        <input
          type="checkbox"
          checked={pick.pressed}
          disabled={pick.disabled}
          onChange={onTogglePick}
          className="size-5 shrink-0 accent-ink disabled:cursor-not-allowed"
        />
        {OPTIONS_STAGE.compare}
        {name}
      </label>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          {entry.angle ? (
            <p className="break-words text-caption font-medium text-ink-muted">
              <span className="sr-only">Pica&apos;s angle: </span>
              {entry.angle}
            </p>
          ) : null}
          <h3 id={nameId} className="break-words text-body-lg font-semibold text-ink">
            {product.title}
          </h3>
          <p className="break-words text-body text-ink-muted">{product.seller.name}</p>
          <Price price={price.price} otherVersions={price.range ?? undefined} className="mt-1" />
          <Rating rating={product.rating} />
          <p className="text-body text-ink">{cardStockText(product)}</p>
          {freshness === "fresh" ? null : <CheckedLine product={product} freshness={freshness} today={today} />}
        </div>

        <Reason label={OPTIONS_STAGE.fits} lines={[lines.fit, ...more.fits]} extraId={ids.fits} open={open} />
        <Reason label={OPTIONS_STAGE.whyNot} lines={[lines.whyNot, ...more.whyNot]} extraId={ids.whyNot} open={open} />

        <div id={ids.more} hidden={!open} className="flex flex-col gap-4">
          {more.value ? (
            <MoreBlock title={OPTIONS_STAGE.value}>
              <p className="break-words text-body-lg text-ink">{more.value}</p>
            </MoreBlock>
          ) : null}
          <MoreBlock title={OPTIONS_STAGE.unverified} tag={<EvidenceTag basis="missing" />}>
            {more.unverified.length > 0 ? (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-body-lg text-ink">
                {more.unverified.map((line, i) => (
                  <li key={`${i}-${line}`} className="break-words">
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-ink">{OPTIONS_STAGE.noneUnverified}</p>
            )}
          </MoreBlock>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <div className="-mx-3 flex flex-wrap items-center justify-between gap-x-2">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={controls}
              onClick={() => setOpen((was) => !was)}
              className={cn(TEXT_LINK, "no-underline")}
            >
              {open ? OPTIONS_STAGE.less : OPTIONS_STAGE.more}
              {name}
              <ChevronDown
                aria-hidden
                size={18}
                className={cn("shrink-0 transition-transform duration-(--duration-fast) ease-out-soft", open && "rotate-180")}
              />
            </button>
            <button type="button" aria-haspopup="dialog" aria-controls={evidenceSheetId} onClick={onEvidence} className={TEXT_LINK}>
              {OPTIONS_STAGE.evidence}
              {name}
            </button>
          </div>
          {/* The card's one button. Not purple: no option is the "right" one. */}
          <Button fullWidth href={decideHref(sessionId, product.id)} disabled={!choosable}>
            {OPTIONS_STAGE.choose}
            {name}
          </Button>
        </div>
      </div>
    </Card>
  );
}
