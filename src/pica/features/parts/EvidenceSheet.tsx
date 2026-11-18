"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { EvidenceTag, Rating, Sheet, evidenceHeading } from "@/pica/components/kit";
import { track } from "@/pica/lib/analytics";
import type { CatalogProduct, EvidenceBasis, ShortlistEntry } from "@/pica/lib/types";
import { EVIDENCE_TITLE, evidenceSheet } from "@/pica/features/shared/evidence-model";

/**
 * The evidence sheet's id on a screen, for `aria-controls` on each "See the
 * evidence" button. A screen has one evidence sheet, so one id serves.
 */
export const EVIDENCE_SHEET_ID = "evidence-sheet";

export interface EvidenceSheetProps {
  sessionId: string;
  /** The product to show. Null closes the sheet. */
  product: CatalogProduct | null;
  /** Its shortlist entry, for Pica's read and what is not verified. Null when it has none. */
  entry: ShortlistEntry | null;
  onClose: () => void;
  /** The dialog's id, for `aria-controls` on what opens it. */
  id?: string;
}

export interface EvidenceSheetViewProps {
  product: CatalogProduct | null;
  entry: ShortlistEntry | null;
  onClose: () => void;
  /** The dialog's id, for `aria-controls` on what opens it. */
  id?: string;
  /** A review search link was opened. */
  onReviewLink?: (site: string) => void;
}

const LINK =
  "inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-pill text-body font-medium text-ink underline underline-offset-4";

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-ink">
      {items.map((item, i) => (
        <li key={`${i}-${item}`} className="break-words">
          {item}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, basis, children }: { title: string; basis?: EvidenceBasis; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-hairline pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-body-lg font-semibold text-ink">{title}</h3>
        {basis ? <EvidenceTag basis={basis} /> : null}
      </div>
      {children}
    </section>
  );
}

function Plain({ children }: { children: ReactNode }) {
  return <p className="text-body text-ink">{children}</p>;
}

function OutLink({ href, children, onClick }: { href: string; children: ReactNode; onClick?: () => void }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK} onClick={onClick}>
      <ExternalLink aria-hidden size={16} className="shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * The sheet's content with no analytics, for screens that count the view
 * themselves and for the parts page. Screens use `EvidenceSheet`.
 */
export function EvidenceSheetView({ product, entry, onClose, id, onReviewLink }: EvidenceSheetViewProps) {
  if (!product) {
    return (
      <Sheet open={false} onClose={onClose} title={EVIDENCE_TITLE} id={id}>
        {null}
      </Sheet>
    );
  }
  const sheet = evidenceSheet(product, entry);
  const { merchant, summary, rating, picaRead, unverified, reviews } = sheet;

  return (
    <Sheet open onClose={onClose} title={sheet.title} description={sheet.description} id={id}>
      <div className="flex flex-col gap-4">
        <Section title={evidenceHeading("merchant")} basis="merchant">
          {merchant.text ? (
            <p className="whitespace-pre-line break-words text-body text-ink">{merchant.text}</p>
          ) : (
            <Plain>{merchant.empty}</Plain>
          )}
          {merchant.link ? <OutLink href={merchant.link.url}>{merchant.link.label}</OutLink> : null}
        </Section>

        <Section title={summary.heading} basis="catalog_summary">
          {summary.items.length > 0 ? <List items={summary.items} /> : <Plain>{summary.empty}</Plain>}
        </Section>

        <Section title="Rating">
          {rating.rating ? (
            <div className="flex flex-col gap-1">
              <Rating rating={rating.rating} />
              {rating.note ? <Plain>{rating.note}</Plain> : null}
            </div>
          ) : (
            <Plain>{rating.empty}</Plain>
          )}
          <p className="text-caption text-ink-muted">{rating.catalogNote}</p>
        </Section>

        {picaRead ? (
          <Section title={evidenceHeading("inference")} basis="inference">
            {picaRead.whyItFits.length > 0 ? (
              <>
                <h4 className="text-body font-semibold text-ink">Why it fits you</h4>
                <List items={picaRead.whyItFits} />
              </>
            ) : null}
            {picaRead.whyNot.length > 0 ? (
              <>
                <h4 className="text-body font-semibold text-ink">Why you might not want it</h4>
                <List items={picaRead.whyNot} />
              </>
            ) : null}
            {picaRead.valueNote ? <Plain>{picaRead.valueNote}</Plain> : null}
          </Section>
        ) : null}

        <Section title={evidenceHeading("missing")} basis="missing">
          {unverified.items.length > 0 ? <List items={unverified.items} /> : <Plain>{unverified.empty}</Plain>}
        </Section>

        <Section title={reviews.heading}>
          <Plain>{reviews.note}</Plain>
          <ul className="flex flex-col">
            {reviews.links.map((link) => (
              <li key={link.site}>
                <OutLink href={link.url} onClick={onReviewLink ? () => onReviewLink(link.site) : undefined}>
                  {link.label}
                </OutLink>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </Sheet>
  );
}

/**
 * "Where this comes from" for one product: a bottom sheet on phone, a
 * centred dialog from 640px. Sends `evidence_viewed` once each time it opens
 * on a product, and `review_link_opened` for each review link.
 */
export function EvidenceSheet({ sessionId, product, entry, onClose, id }: EvidenceSheetProps) {
  const productId = product?.id ?? null;
  const hasEntry = entry !== null;

  useEffect(() => {
    if (productId) track("evidence_viewed", { productId, hasEntry }, sessionId);
  }, [productId, hasEntry, sessionId]);

  return (
    <EvidenceSheetView
      product={product}
      entry={entry}
      onClose={onClose}
      id={id}
      onReviewLink={(site) => {
        if (productId) track("review_link_opened", { productId, site }, sessionId);
      }}
    />
  );
}
