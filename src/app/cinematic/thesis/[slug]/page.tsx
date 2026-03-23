import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCinematicThesisBySlug, getAllCinematicTheses } from "@/lib/cinematic-theses";
import { getManifesto } from "@/lib/manifestos";
import { markdownToHtml } from "@/lib/markdown";
import { ThesisExperience } from "./ThesisExperience";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllCinematicTheses().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const thesis = getCinematicThesisBySlug(slug);
  if (!thesis) return {};
  return {
    title: `${thesis.title} | Cinematic | Andrew Yang`,
    description: thesis.versions[thesis.versions.length - 1].body.slice(0, 160),
  };
}

export default async function CinematicThesisPage({ params }: Props) {
  const { slug } = await params;
  const thesis = getCinematicThesisBySlug(slug);
  if (!thesis) notFound();

  // Get the linked essay/manifesto
  const manifesto = thesis.essaySlug ? getManifesto(thesis.essaySlug) : null;
  const essayHtml = manifesto ? markdownToHtml(manifesto.content) : null;

  // Get related theses
  const allTheses = getAllCinematicTheses();
  const relatedTheses = allTheses.filter((t) =>
    thesis.relatedTheses.includes(t.slug)
  );

  return (
    <ThesisExperience
      thesis={thesis}
      essayHtml={essayHtml}
      relatedTheses={relatedTheses}
    />
  );
}
