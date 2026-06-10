import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { getMemo, getAllMemoSlugs } from "@/lib/memos";
import { getThesisBySlug } from "@/lib/theses";
import { markdownToHtml } from "@/lib/markdown";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllMemoSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const memo = getMemo(slug);
  if (!memo) return {};
  const description = memo.summary || "";
  return {
    title: `${memo.title} | Andrew Yang`,
    description,
    openGraph: {
      title: memo.title,
      description,
      type: "article",
      publishedTime: memo.date,
      url: `/memos/${slug}`,
    },
    twitter: {
      card: "summary",
      title: memo.title,
      description,
    },
  };
}

export default async function MemoPage({ params }: Props) {
  const { slug } = await params;
  const memo = getMemo(slug);
  if (!memo) notFound();

  const html = markdownToHtml(memo.content);
  const linkedThesis = memo.thesisSlug
    ? getThesisBySlug(memo.thesisSlug)
    : null;

  return (
    <div className="min-h-screen">
      <SiteNav current="memos" />
      <main className="mx-auto w-full max-w-2xl px-6 pb-20">
        <Link
          href="/memos"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          &larr; Back to memos
        </Link>
        <article className="mt-8">
          <p className="text-xs text-[var(--color-muted)]">{memo.date}</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight text-[var(--color-ink)]">
            {memo.title}
          </h1>

          {linkedThesis && (
            <div className="mt-4 rounded border border-[var(--color-border-warm)] bg-[var(--color-paper)] px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-[var(--color-accent)]">
                Thesis
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {linkedThesis.body.split("\n\n")[0]}
              </p>
            </div>
          )}

          <div
            className="prose-post mt-8"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* Revision history */}
          {memo.revisions.length > 1 && (
            <div className="mt-12 border-t border-[var(--color-border-warm)] pt-6">
              <p className="text-xs uppercase tracking-wide text-[var(--color-accent)]">
                Changelog
              </p>
              <ul className="mt-3 space-y-2">
                {memo.revisions.map((rev, i) => (
                  <li key={i} className="text-xs text-[var(--color-muted)]">
                    <span className="font-medium">{rev.date}</span>
                    {rev.note && <span> &mdash; {rev.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
