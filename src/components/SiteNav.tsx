import Link from "next/link";
import Image from "next/image";
import { showUnderConstructionPages } from "@/lib/underConstruction";

type SiteNavProps = {
  current?: "home" | "about";
};

export function SiteNav({ current = "home" }: SiteNavProps) {
  const linkClass =
    "text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]";
  const showPages = showUnderConstructionPages();

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-10">
      <Link
        href="/"
        className="inline-flex items-center"
        aria-label="Relora home"
      >
        <Image src="/relora-wordmark.svg" alt="Relora" width={140} height={40} priority />
      </Link>
      {showPages ? (
        <nav className="flex items-center gap-6">
          <Link
            href="/about"
            className={`${linkClass} ${current === "about" ? "text-[var(--color-ink)]" : ""}`}
          >
            About Andrew
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
