import type { ReactNode } from "react";
import type { CatalogImage, Money } from "@/pica/lib/types";
import { cn } from "./cn";
import { Price } from "./Price";
import { ProductImage } from "./ProductImage";

export interface ProductSummaryProps {
  image?: CatalogImage | null;
  name: string;
  merchant: string;
  price: Money;
  /** Thumbnail size: `sm` 40 (compare lines), `md` 56 (default). */
  size?: "sm" | "md";
  /** Something at the row's end, such as a Remove button. */
  trailing?: ReactNode;
  className?: string;
}

/**
 * One row: thumbnail, name, merchant, price. The name shows as text, so the
 * thumbnail is decorative, with or without a photo: screen readers skip it
 * either way. Text wraps; nothing is cut short. In a space
 * under 320px wide the price moves under the merchant, so the name keeps
 * room for whole words.
 */
export function ProductSummary({ image, name, merchant, price, size = "md", trailing, className }: ProductSummaryProps) {
  return (
    <div className={cn("@container min-w-0", className)}>
      <div className="flex items-center gap-3">
        <ProductImage image={image} alt="" radius="thumb" className={cn("shrink-0", size === "sm" ? "w-10" : "w-14")} />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-body font-semibold break-words text-ink">{name}</p>
          <p className="text-body break-words text-ink-soft">{merchant}</p>
          {/* One of the two prices shows at a time; display:none hides the other from screen readers too. */}
          <span className="@xs:hidden">
            <Price price={price} />
          </span>
        </div>
        <span className="hidden shrink-0 text-right @xs:block">
          <Price price={price} />
        </span>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </div>
  );
}
