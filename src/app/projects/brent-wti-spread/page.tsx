import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import {
  BrentWtiSpreadChart,
  type ChartEvent,
} from "@/components/projects/BrentWtiSpreadChart";
import { getBrentWtiSeries, getProjectBySlug } from "@/lib/projects";

const SLUG = "brent-wti-spread";

/*
 * The events the chart marks. They live here rather than in the component because they are copy: the
 * page owns every word a reader sees, and the chart is handed them the same way it is handed prices.
 */
const EVENTS: ChartEvent[] = [
  { date: "2022-02-24", label: "Russia invades Ukraine" },
  {
    date: "2022-12-05",
    label: "EU embargo and G7 price cap on Russian seaborne crude",
  },
  { date: "2023-10-07", label: "Hamas attacks Israel" },
  { date: "2023-11-19", label: "Houthi attacks on Red Sea shipping begin" },
  {
    date: "2024-04-13",
    label: "Iran strikes Israel directly for the first time",
  },
  { date: "2024-10-01", label: "Iran fires second missile barrage at Israel" },
  {
    date: "2025-06-13",
    label: "Israel–Iran 12-day war; US strikes June 21–22",
  },
  { date: "2026-02-28", label: "US–Israel war with Iran begins" },
  { date: "2026-03-09", label: "Strait of Hormuz effectively closed" },
  {
    date: "2026-04-08",
    label: "Ceasefire announced; biggest one-day oil drop in six years",
  },
  { date: "2026-07-08", label: "Re-escalation: US strikes on Iran resume" },
  { date: "2026-07-20", label: "Houthis attack Saudi tankers; Brent tops $100" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function longDate(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function generateMetadata(): Metadata {
  const project = getProjectBySlug(SLUG);
  const title = project?.title ?? "The war premium";
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

export default function BrentWtiSpreadPage() {
  const project = getProjectBySlug(SLUG);
  if (!project) notFound();

  const series = getBrentWtiSeries();
  const last = series.dates.length - 1;
  const latestSpread = series.spread[last].toFixed(2);
  const latestDate = longDate(series.dates[last]);

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
              Brent prices oil that travels by sea — the barrels that leave the
              Gulf through the Strait of Hormuz and the Russian ports of the
              Baltic and the Black Sea. WTI prices oil that sits in Cushing,
              Oklahoma, a long way inland. When a war threatens tankers and
              straits, Brent rises more than WTI does, so the gap between the two
              is a rough measure of what the market charges for war risk.
            </p>
            <p>
              In quiet years that gap is small and dull. The median from 2021
              through 2025 is $3.98 a barrel. The invasion of Ukraine pushed it
              to $14.37 on July 21, 2022. Then the war with Iran pushed it to
              $25.94 on April 8, 2026, the widest it has been since 2012. It has
              narrowed since: the last reading, on {latestDate}, is $
              {latestSpread}.
            </p>
            <p>
              The chart below draws both prices and the gap. Hover anywhere for
              the day&rsquo;s numbers, use the range buttons to zoom into a war,
              and switch the spread to a percentage of WTI if you would rather
              read it that way.
            </p>
          </div>

          {/*
            The chart is the one thing on the page that earns more than the 42rem measure. It widens
            to 56rem from `lg` up, where the viewport has the room to give it, and below that it sits
            in the same column as the prose.
          */}
          <section className="mt-10 lg:-mx-[8.5rem]">
            <BrentWtiSpreadChart series={series} events={EVENTS} />
          </section>

          <div className="prose-post mt-12">
            <h2>How to read this</h2>
            <p>
              <strong>
                Read the distance from the median line, not the level.
              </strong>{" "}
              The spread also carries transport and logistics costs, which have
              nothing to do with war. It blew past $20 in 2011 to 2014 because
              shale oil was arriving in Cushing faster than the pipelines could
              take it out, and no one was shooting at anyone. What marks a war
              premium is the spread pulling away from its own recent normal, the
              way it did after the invasion of Ukraine and again in the 2026 war
              with Iran.
            </p>
            <p>
              <strong>These are spot prices, not futures.</strong> During the
              blockade of the Strait of Hormuz, physical cargoes traded well
              above the futures prices the press was quoting: this series printed
              $138 for Brent on April 7, 2026, while front-month futures peaked
              near $126. A war premium lands hardest on barrels you can load
              today, which is what a spot price measures. The futures market got
              strange too — WTI briefly traded above Brent on April 1, 2026, as
              traders repriced US barrels in the middle of the chaos.
            </p>
            <p>
              <strong>The data lags about a week.</strong> FRED republishes the
              EIA&rsquo;s daily spot prices with a short delay, so the last point
              here is {latestDate}.
            </p>
          </div>

          <p className="mt-10 border-t border-[var(--color-border-warm)] pt-6 text-xs leading-6 text-[var(--color-muted)]">
            Sources: FRED series DCOILBRENTEU and DCOILWTICO, the EIA&rsquo;s
            daily spot prices, fetched August 11, 2026. Spread = Brent &minus;
            WTI. The baseline is a 252-trading-day rolling median of the spread.
          </p>
        </article>
      </main>
    </div>
  );
}
