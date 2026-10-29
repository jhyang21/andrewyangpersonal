import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { CupNotesDemo } from "@/components/projects/cup-notes/CupNotesDemo";
import type { CupNotesIndex } from "@/lib/cup-notes/types";
import { getCupNotesIndex, getProjectBySlug } from "@/lib/projects";

const SLUG = "cup-notes";

const SOURCES = [
  {
    href: "https://www.nrn.com/top-500-restaurants/starbucks-baristas-are-writing-more-than-just-names-on-cups-and-not-everyone-is-happy-about-it",
    label: "Nation’s Restaurant News",
  },
  {
    href: "https://bostonglobe.com/2026/05/06/lifestyle/starbucks-baristas-cup-affirmations-union",
    label: "The Boston Globe",
  },
];

export function generateMetadata(): Metadata {
  const project = getProjectBySlug(SLUG);
  const title = project?.title ?? "The cup note";
  const description = project?.summary;
  return {
    title: `${title} | Andrew Yang`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: project?.date,
      url: `/projects/${SLUG}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

const usd = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const r0 = (v: number) => Math.round(v);

/*
 * The findings below are arithmetic over the saved outcomes, so they move with the dataset and
 * never say a number the data does not hold. Each pulls one contrast an executive would ask for.
 */
function findings(index: CupNotesIndex) {
  const byKey = new Map(index.scenarios.map((s) => [s.key, s]));
  const strict = byKey.get("strict-personal-rush-short");
  const adaptive = byKey.get("adaptive-personal-rush-short");
  const quiet = index.scenarios.filter((s) => s.levers.traffic === "steady" && s.levers.staffing === "full");
  const slammed = index.scenarios.filter((s) => s.levers.traffic === "rush" && s.levers.staffing === "short");
  const personal = index.scenarios.filter((s) => s.levers.note === "personal");
  const mark = index.scenarios.filter((s) => s.levers.note === "mark");
  const strictRuns = index.scenarios.filter((s) => s.levers.enforcement === "strict");
  if (!strict || !adaptive || !quiet.length || !slammed.length || !personal.length || !mark.length || !strictRuns.length) {
    return null;
  }
  const enforceAll = strictRuns.reduce((n, s) => n + s.stance_mix.enforce_all, 0);
  const managers = strictRuns.reduce((n, s) => n + Object.values(s.stance_mix).reduce((a, b) => a + b, 0), 0);
  return {
    strict: strict.outcomes,
    adaptive: adaptive.outcomes,
    quietSat: r0(mean(quiet.map((s) => s.outcomes.customer_satisfaction))),
    slammedSat: r0(mean(slammed.map((s) => s.outcomes.customer_satisfaction))),
    personalConn: r0(mean(personal.map((s) => s.outcomes.connection))),
    markConn: r0(mean(mark.map((s) => s.outcomes.connection))),
    enforceAll,
    managers,
  };
}

export default function CupNotesPage() {
  const project = getProjectBySlug(SLUG);
  if (!project) notFound();

  const index = getCupNotesIndex();
  const { meta } = index;
  const calls =
    meta.counts.manager_calls + meta.counts.barista_calls + meta.counts.customer_calls;
  const generated = meta.generated_at.slice(0, 10);
  const found = findings(index);

  return (
    <div className="min-h-screen">
      <SiteNav current="projects" />
      <main className="mx-auto w-full max-w-2xl px-6 pb-20">
        <Link
          href="/projects"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          &larr; Back to projects
        </Link>

        <article className="mt-8">
          <p className="text-xs text-[var(--color-muted)]">{project.date}</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight text-[var(--color-ink)]">
            {project.title}
          </h1>

          <div className="prose-post mt-8">
            <p>
              Starbucks has asked its baristas to write short notes on cups. Head office wrote one
              rule. What customers got depended on who read it: a store manager judged on
              drive-thru times, a barista with twelve people in line, a regular who likes being
              known, a commuter who just wants the coffee.
            </p>
            <p>
              A policy does not produce an outcome. It passes through people, and each of them
              bends it. This page replays a simulation of that chain, worked out in advance: six
              stores, twelve baristas and ninety-six customers, each one played by a language
              model, under 24 versions of the rule and the shift. Pick a version and run it.
            </p>
          </div>

          {/*
            The demo widens past the 42rem measure: to 60rem from `lg` and 72rem from `xl`, where
            the viewport has room for three manager cards and a shift row on one line. Below `lg`
            it sits in the prose column and stacks.
          */}
          <section className="mt-10 lg:-mx-[10.5rem] xl:-mx-[16.5rem]">
            <CupNotesDemo index={index} />
          </section>

          <div className="prose-post mt-12">
            {found && (
              <>
                <h2>What this run found</h2>
                <ul>
                  <li>
                    <strong>The rule bent before it reached a single cup.</strong> Under the strict
                    rule, only {found.enforceAll} of {found.managers} manager decisions enforced
                    every cup. The rest carved out a rush exception or softened it to a request,
                    each for a reason that fits their store.
                  </li>
                  <li>
                    <strong>Strict and adaptive buy different things.</strong> On a short-staffed
                    rush with personal notes, strict kept notes on{" "}
                    {r0(found.strict.compliance_pct)}% of cups and adaptive on{" "}
                    {r0(found.adaptive.compliance_pct)}%. Strict cost{" "}
                    {found.strict.avg_seconds_added.toFixed(1)} seconds a cup against{" "}
                    {found.adaptive.avg_seconds_added.toFixed(1)}. Customer satisfaction came out
                    at {r0(found.strict.customer_satisfaction)} and{" "}
                    {r0(found.adaptive.customer_satisfaction)}: the note barely moved it.
                  </li>
                  <li>
                    <strong>The line sets satisfaction; the note moves connection.</strong>{" "}
                    Satisfaction averaged {found.quietSat} on quiet, fully staffed shifts and{" "}
                    {found.slammedSat} on short-staffed rushes, whatever the rule. Connection
                    averaged {found.personalConn} across the runs where the note had to be
                    personal and {found.markConn} where any mark counted. A rollout that measures
                    only compliance would miss both.
                  </li>
                </ul>
              </>
            )}

            <h2>How to read this</h2>
            <p>
              <strong>Follow one rule down the chain.</strong> The memo at the top is the same for
              every store. The managers decide what it means for their team, the baristas decide
              what to write with a line in front of them, and the customers decide whether they
              cared. The five numbers at the bottom are what head office would see; everything
              above them is why.
            </p>
            <p>
              <strong>Change one lever at a time.</strong> Run the default, then press Compare and
              switch Enforcement from Strict to Adaptive. The managers, cups and faces swap to the
              new run, and the line under the levers says what moved. The charts at the end put all
              24 runs side by side: who kept the most notes, who kept customers happiest, and what
              each cost in seconds.
            </p>
            <p>
              <strong>Read the quotes, not just the totals.</strong> The numbers say a policy
              worked or failed. The quotes say where it broke: a manager who tells the team one
              thing and thinks another, a barista who stops writing at the fourth cup, a customer
              who liked the note but hated the wait.
            </p>

            <h2>How it was made</h2>
            <p>
              Each person is one call to {meta.model}, with reasoning effort set to{" "}
              {meta.reasoning_effort}, run in advance through OpenAI&rsquo;s batch service. There
              are three rounds, and each one sees only what the person in it would know:
            </p>
            <ul>
              <li>
                <strong>Managers</strong> see the rule, the shift, their store and their own
                job: what they are judged on, how long they have run the store, how they feel
                about programs from head office.
              </li>
              <li>
                <strong>Baristas</strong> see their manager&rsquo;s message, the shift, and the
                eight customers they serve with the line length at each. They decide each cup and
                how many seconds it costs.
              </li>
              <li>
                <strong>Customers</strong> see who they are, where they are, how long they
                waited and what is on their cup. They never see the rule or the manager.
              </li>
            </ul>
            <p>
              The people are the same in every run, so the differences come from the rule and the
              shift, not from new faces. Wait times are worked out by plain arithmetic from the
              line and the seconds each note added; the model never sets them.
            </p>
            {meta.source === "fixture" ? (
              <p>
                <strong>
                  The answers on this page are placeholders from a rule-based stand-in, not the
                  model.
                </strong>{" "}
                The full run is {calls.toLocaleString("en-US")} calls across{" "}
                {meta.counts.scenarios} scenarios ({meta.counts.manager_calls} manager,{" "}
                {meta.counts.barista_calls.toLocaleString("en-US")} barista and{" "}
                {meta.counts.customer_calls.toLocaleString("en-US")} customer); none of them has
                been made for this version.
              </p>
            ) : (
              <p>
                This run made {calls.toLocaleString("en-US")} calls across{" "}
                {meta.counts.scenarios} scenarios ({meta.counts.manager_calls} manager,{" "}
                {meta.counts.barista_calls.toLocaleString("en-US")} barista and{" "}
                {meta.counts.customer_calls.toLocaleString("en-US")} customer), used{" "}
                {(meta.tokens.input + meta.tokens.output).toLocaleString("en-US")} tokens and cost{" "}
                {usd(meta.usd)}. {meta.schema_failures} answers failed the schema check. Generated{" "}
                {generated}, prompt version {meta.prompt_version}.
              </p>
            )}

            <h2>What this is not</h2>
            <p>
              It is not Starbucks data. The stores, managers, baristas and customers are invented,
              and a language model wrote every word they say. It is not a forecast either: it
              shows how a rule can bend as it passes through people, not how often it will. Use it
              the way you would use a tabletop exercise before a rollout to thousands of stores: to
              find the questions worth testing in real stores, not to answer them.
            </p>
          </div>

          <p className="mt-10 border-t border-[var(--color-border-warm)] pt-6 text-xs leading-6 text-[var(--color-muted)]">
            Sources on the real policy:{" "}
            {SOURCES.map((s, i) => (
              <span key={s.href}>
                {i > 0 && " and "}
                <a
                  href={s.href}
                  className="underline underline-offset-2 hover:text-[var(--color-ink)]"
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.label}
                </a>
              </span>
            ))}
            . {meta.disclaimer}
          </p>
        </article>
      </main>
    </div>
  );
}
