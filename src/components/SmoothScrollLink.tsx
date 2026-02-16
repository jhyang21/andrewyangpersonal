"use client";

import type { ComponentPropsWithoutRef, MouseEvent } from "react";

type SmoothScrollLinkProps = ComponentPropsWithoutRef<"a"> & {
  href: string;
};

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SmoothScrollLink({ href, onClick, ...props }: SmoothScrollLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const hashIndex = href.indexOf("#");
    if (hashIndex === -1) return;

    const rawHash = href.slice(hashIndex + 1);
    if (!rawHash) return;

    const targetId = decodeURIComponent(rawHash);
    const target = document.getElementById(targetId);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });

    // Keep the URL in sync without a hard jump.
    if (typeof history !== "undefined" && typeof history.pushState === "function") {
      history.pushState(null, "", `#${rawHash}`);
    }
  }

  return <a href={href} onClick={handleClick} {...props} />;
}
