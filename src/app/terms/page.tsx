import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/SiteNav";
import { showUnderConstructionPages } from "@/lib/underConstruction";

export const metadata: Metadata = {
  title: "Terms",
  description: "Relora terms summary.",
};

export default function TermsPage() {
  const showPages = showUnderConstructionPages();

  if (!showPages) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <SiteNav current="home" />
      <main className="mx-auto max-w-3xl px-6 py-12 text-[var(--color-ink)] md:px-10">
        <h1 className="font-serif text-4xl">Terms</h1>
        <p className="mt-4 text-[var(--color-muted)]">
          This site provides early access information for Relora. Feature details may evolve during
          product development.
        </p>
      </main>
    </div>
  );
}
