"use client";

import { ExternalLink } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Card, EvidenceTag, Price, ProductImage, Rating } from "@/pica/components/kit";
import type { CatalogProduct, Comparison, ComparisonCell } from "@/pica/lib/types";
import { CheckedLine, type Freshness } from "@/pica/features/shared/freshness";
import { productImage } from "@/pica/features/shared/format";
import { cellEvidence, cellFor } from "./compare-model";
import { COMPARE_STAGE } from "./compare-stage-model";
import { OPTIONS_STAGE, canChoose, cardStockText, domKey } from "./options-stage-model";
import { decideHref, priceLine } from "./shortlist-model";

export interface ComparisonViewProps {
  sessionId: string;
  comparison: Comparison;
  /** The compared products the session holds, in the comparison's order. */
  products: CatalogProduct[];
  freshness: (product: CatalogProduct) => Freshness;
  today: number | null;
  onEvidence: (productId: string) => void;
  /** The evidence sheet's id, for `aria-controls`, where the page has that sheet. */
  evidenceSheetId?: string;
  /** Starts every id inside, so the table and the stacked cards never share one. */
  idPrefix: string;
}

/** The catalog's facts, in the brief's order: price, stock, rating. No tags: the row says where they come from. */
function catalogFacts(freshness: ComparisonViewProps["freshness"], today: number | null) {
  return [
    {
      label: COMPARE_STAGE.price,
      render: (product: CatalogProduct) => {
        const { price, range } = priceLine(product);
        return <Price price={price} otherVersions={range ?? undefined} size="sm" />;
      },
    },
    {
      label: COMPARE_STAGE.stock,
      render: (product: CatalogProduct) => (
        <div className="flex flex-col gap-1">
          <p>{cardStockText(product)}</p>
          <CheckedLine product={product} freshness={freshness(product)} today={today} />
        </div>
      ),
    },
    {
      label: COMPARE_STAGE.rating,
      render: (product: CatalogProduct) =>
        product.rating && product.rating.count > 0 ? <Rating rating={product.rating} /> : <p>{COMPARE_STAGE.noRating}</p>,
    },
  ];
}

/**
 * Pica's note for one option on one need, with its evidence tag. A tag with
 * a checked quote opens the quote beneath the cell.
 */
function CellNote({ cell, product, quoteId }: { cell: ComparisonCell | null; product: CatalogProduct; quoteId: string }) {
  const [open, setOpen] = useState(false);
  if (!cell) {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <p>{COMPARE_STAGE.noCell}</p>
        <EvidenceTag basis="missing" />
      </div>
    );
  }
  const { tag, quote, url } = cellEvidence(cell, product);
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <p className="break-words">{cell.note}</p>
      {quote !== null ? (
        <>
          <EvidenceTag basis={tag} onToggle={() => setOpen((was) => !was)} expanded={open} controls={quoteId} />
          <div id={quoteId} hidden={!open} className="flex flex-col items-start gap-1">
            <q className="break-words border-l-2 border-ink-muted pl-2 text-caption text-ink">{quote}</q>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 text-caption font-medium text-ink underline underline-offset-4"
              >
                <ExternalLink aria-hidden size={14} className="shrink-0" />
                {COMPARE_STAGE.seeListing}
                <span className="sr-only"> for {product.title} (opens in a new tab)</span>
              </a>
            ) : null}
          </div>
        </>
      ) : (
        <EvidenceTag basis={tag} />
      )}
    </div>
  );
}

/** "See the evidence" and "Choose this one" for one option. Choose is off only when every version is sold out. */
function OptionActions({
  sessionId,
  product,
  onEvidence,
  evidenceSheetId,
}: {
  sessionId: string;
  product: CatalogProduct;
  onEvidence: () => void;
  evidenceSheetId?: string;
}) {
  const name = <span className="sr-only">: {product.title}</span>;
  return (
    <div className="flex flex-col gap-2">
      <Button fullWidth aria-haspopup="dialog" aria-controls={evidenceSheetId} onClick={onEvidence}>
        {OPTIONS_STAGE.evidence}
        {name}
      </Button>
      <Button fullWidth href={decideHref(sessionId, product.id)} disabled={!canChoose(product)}>
        {OPTIONS_STAGE.choose}
        {name}
      </Button>
    </div>
  );
}

const ROW_HEAD = "p-3 text-left align-top text-body font-semibold text-ink break-words";
const CELL = "p-3 align-top text-body text-ink break-words";
const GROUP_HEAD = "bg-canvas px-3 py-2 text-left text-caption font-semibold text-ink";

/**
 * The comparison as a real table: a 128px label column and one column per
 * option, sharing the rest. It never scrolls sideways; the stage shows it
 * only while each column has 160px (see `layoutClasses`).
 */
export function ComparisonTable({ sessionId, comparison, products, freshness, today, onEvidence, evidenceSheetId, idPrefix }: ComparisonViewProps) {
  const facts = catalogFacts(freshness, today);
  const span = products.length + 1;
  return (
    <Card padding="none" className="overflow-hidden">
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">
          Pica&apos;s comparison of {products.length} options. Facts from the catalog first, then Pica&apos;s notes on your needs.
        </caption>
        <colgroup>
          <col className="w-32" />
          {products.map((product) => (
            <col key={product.id} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-hairline">
            <td className="p-3">
              <span className="sr-only">{COMPARE_STAGE.detail}</span>
            </td>
            {products.map((product) => (
              <th key={product.id} scope="col" className={ROW_HEAD}>
                <div className="flex flex-col gap-1.5">
                  <ProductImage image={productImage(product)} alt="" radius="thumb" className="w-16" />
                  <span>{product.title}</span>
                  <span className="text-caption font-normal text-ink-muted">{product.seller.name}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="rowgroup" colSpan={span} className={GROUP_HEAD}>
              {COMPARE_STAGE.catalogGroup}
            </th>
          </tr>
          {facts.map((fact) => (
            <tr key={fact.label} className="border-b border-hairline">
              <th scope="row" className={ROW_HEAD}>
                {fact.label}
              </th>
              {products.map((product) => (
                <td key={product.id} className={CELL}>
                  {fact.render(product)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tbody>
          <tr>
            <th scope="rowgroup" colSpan={span} className={GROUP_HEAD}>
              {COMPARE_STAGE.picaGroup}
            </th>
          </tr>
          {comparison.rows.map((row, index) => (
            <tr key={`${index}-${row.priority}`} className="border-b border-hairline">
              {/* Pica's words for the row. Not editable: the needs above are. */}
              <th scope="row" className={ROW_HEAD}>
                {row.priority}
              </th>
              {products.map((product) => (
                <td key={product.id} className={CELL}>
                  <CellNote
                    cell={cellFor(row.cells, product.id)}
                    product={product}
                    quoteId={`${idPrefix}-quote-${index}-${domKey(product.id)}`}
                  />
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row" className={ROW_HEAD}>
              <span className="sr-only">{COMPARE_STAGE.actions}</span>
            </th>
            {products.map((product) => (
              <td key={product.id} className={CELL}>
                <OptionActions sessionId={sessionId} product={product} onEvidence={() => onEvidence(product.id)} evidenceSheetId={evidenceSheetId} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </Card>
  );
}

/** One option's line inside a stacked card: thumbnail and name, then what it says on this row. */
function StackLine({ product, children }: { product: CatalogProduct; children: ReactNode }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <ProductImage image={productImage(product)} alt="" radius="thumb" className="w-10 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-body text-ink">
        <p className="break-words font-semibold">{product.title}</p>
        {children}
      </div>
    </li>
  );
}

function StackCard({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h4 className="break-words text-body-lg font-semibold text-ink">{title}</h4>
        {note ? <p className="text-caption text-ink-muted">{note}</p> : null}
      </div>
      <ul className="flex flex-col divide-y divide-hairline">{children}</ul>
    </Card>
  );
}

/** The same comparison as one card per row, for a stage too narrow for the table. */
export function ComparisonStack({ sessionId, comparison, products, freshness, today, onEvidence, evidenceSheetId, idPrefix }: ComparisonViewProps) {
  const facts = catalogFacts(freshness, today);
  return (
    <div className="flex flex-col gap-3">
      {facts.map((fact) => (
        <StackCard key={fact.label} title={fact.label} note={COMPARE_STAGE.catalogGroup}>
          {products.map((product) => (
            <StackLine key={product.id} product={product}>
              {fact.render(product)}
            </StackLine>
          ))}
        </StackCard>
      ))}
      {comparison.rows.map((row, index) => (
        <StackCard key={`${index}-${row.priority}`} title={row.priority}>
          {products.map((product) => (
            <StackLine key={product.id} product={product}>
              <CellNote
                cell={cellFor(row.cells, product.id)}
                product={product}
                quoteId={`${idPrefix}-quote-${index}-${domKey(product.id)}`}
              />
            </StackLine>
          ))}
        </StackCard>
      ))}
      <StackCard title={COMPARE_STAGE.actions}>
        {products.map((product) => (
          <StackLine key={product.id} product={product}>
            <OptionActions sessionId={sessionId} product={product} onEvidence={() => onEvidence(product.id)} evidenceSheetId={evidenceSheetId} />
          </StackLine>
        ))}
      </StackCard>
    </div>
  );
}
