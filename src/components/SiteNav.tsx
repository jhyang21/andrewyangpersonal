import Link from "next/link";

type SiteNavProps = {
  current?: "home" | "memos";
};

export function SiteNav({ current = "home" }: SiteNavProps) {
  const linkClass =
    "text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]";
  const activeClass = "text-[var(--color-ink)]";

  return (
    <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-8">
      <Link
        href="/"
        className="font-serif text-lg font-semibold text-[var(--color-ink)]"
      >
        Andrew Yang
      </Link>
      <nav className="flex items-center gap-6">
        <Link
          href="/memos"
          className={`${linkClass} ${current === "memos" ? activeClass : ""}`}
        >
          Memos
        </Link>
      </nav>
    </header>
  );
}
