"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CinematicNav() {
  const pathname = usePathname();
  const isWall = pathname === "/cinematic";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-5 md:px-10">
      <Link
        href="/cinematic"
        className="font-serif text-lg font-semibold tracking-tight text-[var(--color-ink)] transition-opacity hover:opacity-70"
      >
        Andrew Yang
      </Link>
      <nav className="flex items-center gap-6">
        {!isWall && (
          <Link
            href="/cinematic"
            className="text-xs uppercase tracking-widest text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            Wall
          </Link>
        )}
        <Link
          href="/"
          className="text-xs uppercase tracking-widest text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
        >
          Exit
        </Link>
      </nav>
    </header>
  );
}
