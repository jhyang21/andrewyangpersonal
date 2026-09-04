import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { getRecentMemos } from "@/lib/memos";

export default function HomePage() {
  const recentMemos = getRecentMemos(3);

  return (
    <div className="min-h-screen">
      <SiteNav current="home" />
      <main className="mx-auto w-full max-w-2xl px-6 pb-20">
        {/* Intro */}
        <section className="py-12">
          <h1 className="font-serif text-4xl leading-tight text-[var(--color-ink)]">
            Hey, I&apos;m Andrew.
          </h1>
          <div className="mt-6 space-y-4 text-base leading-7 text-[var(--color-muted)]">
            <p>
              I&apos;m a founder currently building{" "}
              <a
                href="https://reloraapp.com"
                className="text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-ink)]"
                target="_blank"
                rel="noreferrer"
              >
                Relora
              </a>
              , a personal CRM that helps you remember the small details about people.
              Press a button, leave a voice note, and Relora organizes it all so you show up
              to every conversation like you actually care (because you do).
            </p>
            <p>
              Before this, I co-founded{" "}
              <span className="text-[var(--color-ink)] font-medium">immForm</span> in college, where
              we built AI to automate admin work for lawyers. We went deep on
              document processing, conversational form-filling, and the unglamorous side of
              legal tech. We went through 4 pivots before we stopped building and learned that the legal
              industry was not a good fit for us. 
            </p>
            <p>
              Right now I&apos;m on a year-long{" "}
              <span className="text-[var(--color-ink)] font-medium">sidequest</span>: building
              Relora, working as a barista at Ape Coffee (my dream part-time job), tutoring
              for essay competitions, and competing in hackathons whenever I can. I&apos;ve built
              everything from prediction market bots to a voice-native cooking assistant.
            </p>
            <p>
              I majored in Psychology and minored in Artificial Intelligence at Emory, where I published{" "}
              <a
                href="https://dl.acm.org/doi/abs/10.1145/3706598.3714400"
                className="text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-ink)]"
                target="_blank"
                rel="noreferrer"
              >
                a paper on metacognition
              </a>{" "}
              at the Cognition &amp; Visualization Lab.
            </p>
            <p>
              I care about building things that truly help people, making their day or their life better. 
              That&apos;s the thread through everything I do.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <a
              href="mailto:andrew@immform.com"
              className="text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
            >
              Email
            </a>
            <a
              href="https://www.linkedin.com/in/junhyeok-andrew-yang/"
              className="text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
            <a
              href="https://github.com/jhyang21"
              className="text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              href="https://x.com/andrewyang_X"
              className="text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
              target="_blank"
              rel="noreferrer"
            >
              X
            </a>
          </div>
        </section>

        {/* Recent memos */}
        {recentMemos.length > 0 && (
          <section className="border-t border-[var(--color-border-warm)] pt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-[var(--color-ink)]">
                Recent memos
              </h2>
              <Link
                href="/memos"
                className="text-sm text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
              >
                See all
              </Link>
            </div>
            <ul className="mt-6 space-y-6">
              {recentMemos.map((m) => (
                <li key={m.slug}>
                  <Link
                    href={`/memos/${m.slug}`}
                    className="group block"
                  >
                    <p className="text-xs text-[var(--color-muted)]">
                      {m.date}
                    </p>
                    <h3 className="mt-1 text-base font-medium text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                      {m.title}
                    </h3>
                    {m.summary && (
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        {m.summary}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
