import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { getManifesto, getAllManifestoSlugs } from "@/lib/manifestos";
import { getThesisBySlug } from "@/lib/theses";
import { markdownToHtml } from "@/lib/markdown";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllManifestoSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const manifesto = getManifesto(slug);
  if (!manifesto) return {};
  return {
    title: `${manifesto.title} | Andrew Yang`,
    description: manifesto.summary || "",
  };
}

export default async function ManifestoPage({ params }: Props) {
  const { slug } = await params;
  const manifesto = getManifesto(slug);
  if (!manifesto) notFound();

  const html = markdownToHtml(manifesto.content);
  const linkedThesis = manifesto.thesisSlug
    ? getThesisBySlug(manifesto.thesisSlug)
    : null;

  return (
    <div className="min-h-screen">
      <SiteNav current="manifestos" />
      <main className="mx-auto w-full max-w-2xl px-6 pb-20">
        <Link
          href="/manifestos"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          &larr; Back to manifestos
        </Link>
        <article className="mt-8">
          <p className="text-xs text-[var(--color-muted)]">{manifesto.date}</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight text-[var(--color-ink)]">
            {manifesto.title}
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
          {manifesto.revisions.length > 1 && (
            <div className="mt-12 border-t border-[var(--color-border-warm)] pt-6">
              <p className="text-xs uppercase tracking-wide text-[var(--color-accent)]">
                Changelog
              </p>
              <ul className="mt-3 space-y-2">
                {manifesto.revisions.map((rev, i) => (
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
