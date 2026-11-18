"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import type { CatalogImage } from "@/pica/lib/types";
import { cn } from "./cn";

export interface ProductImageProps {
  /**
   * The catalog image. Missing or broken images show a plain placeholder,
   * read as "<alt>, no photo", or skipped when the image is decorative.
   */
  image?: CatalogImage | null;
  /**
   * Text for screen readers. Pass the product name: catalog alt text is
   * often empty or a merchant's internal note. Overrides `image.alt`.
   *
   * When both this and `image.alt` are empty, the photo renders as
   * decorative (`alt=""`) and screen readers skip it. That is right only
   * when the product name shows as text beside the photo.
   */
  alt?: string;
  /** `image` (20) inside cards, `thumb` (12) for small thumbnails. */
  radius?: "image" | "thumb";
  /** Load now instead of when scrolled near. Use for the first image on a screen. */
  eager?: boolean;
  className?: string;
}

/** A 1:1 product photo, cropped to fill. */
export function ProductImage({ image, alt, radius = "image", eager = false, className }: ProductImageProps) {
  // Remember which URL failed, so a new URL gets a fresh try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const label = (alt ?? image?.alt ?? "").trim();
  // No text from the caller or the catalog: treat the photo as decorative on
  // purpose. Callers show the name beside it (see the `alt` prop).
  const decorative = label === "";
  const showImage = image?.url && failedUrl !== image.url;

  const frame = cn(
    // Block width fills the parent; pass a width class to size it.
    "relative aspect-square overflow-hidden bg-canvas",
    radius === "thumb" ? "rounded-thumb" : "rounded-image",
    className,
  );

  if (!showImage) {
    // A decorative slot stays decorative with no photo: screen readers skip
    // it, as they would skip the photo, rather than hear "No photo" next to
    // a name they already heard.
    const a11y = decorative ? { "aria-hidden": true } : { role: "img", "aria-label": `${label}, no photo` };
    return (
      <div {...a11y} className={cn(frame, "flex items-center justify-center text-ink-muted")}>
        <ImageOff aria-hidden size={radius === "thumb" ? 16 : 24} />
      </div>
    );
  }

  return (
    <div className={frame}>
      {/*
        Plain <img> on purpose: product photos come from many merchant CDNs,
        and next/image would need every host listed in next.config.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={decorative ? "" : label}
        role={decorative ? "presentation" : undefined}
        width={image.width}
        height={image.height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(image.url)}
        // An image can fail before React hydrates and misses onError.
        ref={(el) => {
          if (el && el.complete && el.naturalWidth === 0) setFailedUrl(image.url);
        }}
        className="size-full object-cover"
      />
    </div>
  );
}
