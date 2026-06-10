import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { getAllMemos } from "@/lib/memos";

export const metadata = {
  title: "Memos | Andrew Yang",
  description: "Personal memos on building, startups, and life.",
};

export default function MemosPage() {
  const memos = getAllMemos();

  return (
    <div className="min-h-screen">
      <SiteNav current="memos" />
      <main className="mx-auto w-full max-w-2xl px-6 pb-20">
        <h1 className="font-serif text-4xl text-[var(--color-ink)]">Memos</h1>
        <p className="mt-3 text-base text-[var(--color-muted)]">
          Long-form versions of what I believe. Each one ties back to a thesis.
        </p>

        {memos.length === 0 ? (
          <p className="mt-12 text-sm text-[var(--color-muted)]">
            Nothing here yet. Check back soon.
          </p>
        ) : (
          <ul className="mt-10 space-y-8">
            {memos.map((m) => (
              <li
                key={m.slug}
                className="border-b border-[var(--color-border-warm)] pb-8 last:border-0"
              >
                <Link href={`/memos/${m.slug}`} className="group block">
                  <p className="text-xs text-[var(--color-muted)]">{m.date}</p>
                  <h2 className="mt-1 font-serif text-xl text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                    {m.title}
                  </h2>
                  {m.summary && (
                    <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                      {m.summary}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
