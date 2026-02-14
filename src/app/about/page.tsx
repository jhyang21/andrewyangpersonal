import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "About Andrew",
  description: "About Andrew and why he is building Relora.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <SiteNav current="about" />
      <main className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
        <section className="grid gap-8 py-10 md:grid-cols-[1fr_1fr] md:py-16">
          <div className="space-y-5">
            <h1 className="font-serif text-5xl leading-[1.05] text-[var(--color-ink)]">About Andrew</h1>
            <p className="max-w-[58ch] text-base leading-7 text-[var(--color-muted)]">
              I am a builder focused on tools that make people better at showing up for each other.
              I care about product craft, thoughtful UX, and building things that people trust in
              their daily lives.
            </p>
            <Card className="bg-[var(--color-secondary-tint)]/35">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-secondary)]">
                Building now
              </p>
              <p className="mt-2 text-base text-[var(--color-ink)]">
                Relora, a personal relationship memory app that helps you remember the details that
                keep connections warm.
              </p>
            </Card>
          </div>

          <div className="grid gap-4">
            <Card fold>
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-secondary)]">Current focus</p>
              <p className="mt-2 text-[var(--color-ink)]">
                Shipping waitlist MVP, refining memory capture UX, and validating early user
                workflows.
              </p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-secondary)]">Past projects</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-[var(--color-ink)]">
                <li>Shipped product experiments end-to-end from idea to launch.</li>
                <li>Built internal tools for teams where relationships and context matter.</li>
                <li>Obsessed over clear writing and humane product details.</li>
              </ul>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-secondary)]">Reach me</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <a className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]" href="mailto:andrew@relora.app">
                  Email
                </a>
                <a className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-muted)]" href="https://github.com" target="_blank" rel="noreferrer">
                  GitHub
                </a>
                <a className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-muted)]" href="https://linkedin.com" target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
                <a className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-muted)]" href="https://x.com" target="_blank" rel="noreferrer">
                  X
                </a>
              </div>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
