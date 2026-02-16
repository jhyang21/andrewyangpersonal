import type { Metadata } from "next";
import Image from "next/image";
import { Card } from "@/components/Card";
import { MemoryCardStack } from "@/components/MemoryCardStack";
import { SiteNav } from "@/components/SiteNav";
import { SmoothScrollLink } from "@/components/SmoothScrollLink";
import { WaitlistFlow } from "@/components/WaitlistFlow";
import { showUnderConstructionPages } from "@/lib/underConstruction";

const howItWorks = [
  {
    title: "Capture",
    body: "Record a quick voice note after meeting or talking to someone.",
  },
  {
    title: "Organize",
    body: "Relora turns it into clean memories, tags, and reminders tied to contacts.",
  },
  {
    title: "Surface",
    body: "Get context before calls, meetings, or events so you show up prepared.",
  },
];

const useCases = [
  "Real estate agents and brokers",
  "Lawyers and legal professionals",
  "Financial advisors",
  "Friends and family",
];

export const metadata: Metadata = {
  title: "Relora waitlist",
  description: "Remember the small details that build relationships.",
};

export default function HomePage() {
  const showPages = showUnderConstructionPages();

  return (
    <div className="min-h-screen">
      <SiteNav current="home" />
      <main className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
        <section className="grid items-center gap-10 py-10 md:grid-cols-[1.1fr_0.9fr] md:py-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-secondary)]">
              Relora waitlist
            </p>
            <h1 className="mt-4 max-w-[14ch] font-serif text-5xl leading-[1.05] text-[var(--color-ink)] md:text-6xl">
              Remember the small details that build relationships.
            </h1>
            <p className="mt-5 max-w-[56ch] text-lg leading-8 text-[var(--color-muted)]">
              Relora turns quick voice notes into structured context tied to contacts, so you are ready for every conversation.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <SmoothScrollLink
                href="#waitlist"
                className="inline-block rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-paper)] transition hover:bg-[var(--color-primary-hover)]"
              >
                Join the waitlist
              </SmoothScrollLink>
              <SmoothScrollLink
                href="#how-it-works"
                className="inline-block rounded-full border border-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-primary-tint)]"
              >
                See how it works
              </SmoothScrollLink>
            </div>
          </div>
          <MemoryCardStack />
        </section>

        <section id="how-it-works" className="mt-14 grid gap-5 md:grid-cols-3">
          {howItWorks.map((item, index) => (
            <Card
              key={item.title}
              className={
                index === 1
                  ? "md:-translate-y-3 bg-[var(--color-primary-tint)] border-[var(--color-primary)] shadow-[0_14px_34px_rgba(16,20,24,0.10)]"
                  : ""
              }
              fold={index === 1}
            >
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-secondary)]">
                Step {index + 1}
              </p>
              <h2 className="mt-2 font-serif text-2xl text-[var(--color-ink)]">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{item.body}</p>
            </Card>
          ))}
        </section>

        <section className="mt-20">
          <Card className="grid items-center gap-6 p-6 md:grid-cols-[1fr_1.2fr]" fold>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-secondary)]">Demo concept</p>
              <h2 className="mt-2 font-serif text-3xl text-[var(--color-ink)]">
                Contact card plus memory timeline
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                A single place to see who the person is, what mattered last time, and what you may want
                to talk about next.
              </p>
            </div>
            <Image
              src="/hero-memory-cards.svg"
              alt="Relora memory card concept"
              width={640}
              height={480}
              className="h-auto w-full rounded-2xl border border-[var(--color-border-warm)]"
            />
          </Card>
        </section>

        <section className="mt-20">
          <h2 className="font-serif text-3xl text-[var(--color-ink)]">Built for everyday relationships</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {useCases.map((useCase) => (
              <Card key={useCase}>
                <p className="text-base font-medium text-[var(--color-ink)]">{useCase}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="waitlist" className="mt-20">
          <h2 className="mb-4 font-serif text-3xl text-[var(--color-ink)]">Join early users shaping Relora</h2>
          <WaitlistFlow />
        </section>

        <footer className="mt-20 border-t border-[var(--color-border-warm)] py-8 text-sm text-[var(--color-muted)]">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <p>Contact: andrew@immform.com</p>
            <div className="flex gap-4">
              <a className="hover:text-[var(--color-ink)]" href="https://www.linkedin.com/in/junhyeok-andrew-yang/" target="_blank" rel="noreferrer">
                LinkedIn
              </a>
              {showPages ? (
                <>
                  <a className="hover:text-[var(--color-ink)]" href="/privacy">
                    Privacy
                  </a>
                  <a className="hover:text-[var(--color-ink)]" href="/terms">
                    Terms
                  </a>
                </>
              ) : null}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
