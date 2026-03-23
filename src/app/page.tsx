import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { getRecentManifestos } from "@/lib/manifestos";

export default function HomePage() {
  const recentManifestos = getRecentManifestos(3);

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
                href="https://relora.app"
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
              <span className="text-[var(--color-ink)] font-medium">immForm</span>, where
              we built AI to automate admin work for immigration lawyers. We went deep on
              document processing, conversational form-filling, and the unglamorous side of
              legal tech.
            </p>
            <p>
              I&apos;ve also spent time on the investing side as a VC scout at LvlUp
              Ventures and IgniteXL, sourcing early-stage deals across AI, SaaS, and
              healthtech. It gave me a good eye for what makes a founding team tick.
            </p>
            <p>
              Right now I&apos;m on a year-long{" "}
              <span className="text-[var(--color-ink)] font-medium">sidequest</span>: building
              Relora, working as a barista at Ape Coffee (a dream part-time job), tutoring
              for essay competitions, and competing in hackathons whenever I can. I&apos;ve built
              everything from prediction market bots to a voice-native cooking assistant.
            </p>
            <p>
              I studied at Emory, where I did metacognition research at the Cognition &amp;
              Visualization Lab. Before all of this, I interned at the International Vaccine
              Institute in Seoul and a law firm called Yulchon.
            </p>
            <p>
              I care about building things people trust in their daily lives. That&apos;s the
              thread through everything I do.
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
              href="https://x.com/"
              className="text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
              target="_blank"
              rel="noreferrer"
            >
              X
            </a>
          </div>
        </section>

        {/* Recent manifestos */}
        {recentManifestos.length > 0 && (
          <section className="border-t border-[var(--color-border-warm)] pt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl text-[var(--color-ink)]">
                Recent manifestos
              </h2>
              <Link
                href="/manifestos"
                className="text-sm text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
              >
                See all
              </Link>
            </div>
            <ul className="mt-6 space-y-6">
              {recentManifestos.map((m) => (
                <li key={m.slug}>
                  <Link
                    href={`/manifestos/${m.slug}`}
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
