import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { CupNotesDemo } from "@/components/projects/cup-notes/CupNotesDemo";
import type { CupNotesIndex, ScenarioDetail, ScenarioSummary } from "@/lib/cup-notes/types";
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

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const r0 = (v: number) => Math.round(v);
const band = (xs: number[]) => ({ lo: r0(Math.min(...xs)), hi: r0(Math.max(...xs)) });

const RUSH = "strict-personal-rush-short";
const WAIVED = "adaptive-personal-rush-short";

/*
 * Arithmetic over the saved outcomes, plus one scenario file for the shift a reader lands on.
 * A sentence appears only when the file still holds the number.
 */
function findings(index: CupNotesIndex) {
  const byKey = new Map(index.scenarios.map((s) => [s.key, s]));
  const strict = byKey.get(RUSH);
  const adaptive = byKey.get(WAIVED);
  const flexible = byKey.get("flexible-personal-rush-short");
  const quietPersonal = byKey.get("strict-personal-steady-full");
  const quietMark = byKey.get("strict-mark-steady-full");
  const quiet = index.scenarios.filter((s) => s.levers.traffic === "steady" && s.levers.staffing === "full");
  const slammed = index.scenarios.filter((s) => s.levers.traffic === "rush" && s.levers.staffing === "short");
  const personal = index.scenarios.filter((s) => s.levers.note === "personal");
  const mark = index.scenarios.filter((s) => s.levers.note === "mark");
  const strictRuns = index.scenarios.filter((s) => s.levers.enforcement === "strict");
  if (
    !strict ||
    !adaptive ||
    !flexible ||
    !quietPersonal ||
    !quietMark ||
    !quiet.length ||
    !slammed.length ||
    !personal.length ||
    !mark.length ||
    !strictRuns.length
  ) {
    return null;
  }
  const enforceAll = strictRuns.reduce((n, s) => n + s.stance_mix.enforce_all, 0);
  const managers = strictRuns.reduce((n, s) => n + Object.values(s.stance_mix).reduce((a, b) => a + b, 0), 0);
  const quietSat = quiet.map((s) => s.outcomes.customer_satisfaction);
  const stress = slammed.map((s) => s.outcomes.barista_stress);
  const sentiment = slammed.map((s) => s.outcomes.barista_sentiment);
  return {
    strict,
    adaptive,
    flexible,
    quietPersonal,
    quietMark,
    quietSat: r0(mean(quietSat)),
    quietBand: band(quietSat),
    stress: band(stress),
    sentiment: band(sentiment),
    personalConn: r0(mean(personal.map((s) => s.outcomes.connection))),
    markConn: r0(mean(mark.map((s) => s.outcomes.connection))),
    personalSat: r0(mean(personal.map((s) => s.outcomes.customer_satisfaction))),
    markSat: r0(mean(mark.map((s) => s.outcomes.customer_satisfaction))),
    personalSec: mean(personal.map((s) => s.outcomes.avg_seconds_added)),
    markSec: mean(mark.map((s) => s.outcomes.avg_seconds_added)),
    personalMention: r0(mean(personal.map((s) => s.outcomes.would_mention_pct))),
    markMention: r0(mean(mark.map((s) => s.outcomes.would_mention_pct))),
    enforceAll,
    managers,
    scenarios: index.scenarios.length,
  };
}

function readScenario(key: string): ScenarioDetail | null {
  const file = path.join(process.cwd(), "public", "cup-notes", "scenarios", `${key}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as ScenarioDetail;
}

function strictRuleCountsAudit(): boolean {
  const file = path.join(process.cwd(), "simulation", "config", "levers.json");
  if (!fs.existsSync(file)) return false;
  const levers = JSON.parse(fs.readFileSync(file, "utf8")) as {
    enforcement: { key: string; policy_text: string }[];
  };
  const text = levers.enforcement.find((o) => o.key === "strict")?.policy_text ?? "";
  return text.includes("audit");
}

type Group = { n: number; noticed: number; mention: number; sat: number; conn: number; annoyed: number };

function groupOf(detail: ScenarioDetail, key: string): Group | null {
  const cups = detail.shifts.flatMap((s) => s.cups).filter((c) => c.customer === key);
  if (!cups.length) return null;
  return {
    n: cups.length,
    noticed: cups.filter((c) => c.reaction.noticed).length,
    mention: cups.filter((c) => c.reaction.would_mention).length,
    sat: r0(mean(cups.map((c) => c.reaction.satisfaction))),
    conn: r0(mean(cups.map((c) => c.reaction.connection))),
    annoyed: cups.filter((c) => c.reaction.reaction === "annoyed").length,
  };
}

function faces(detail: ScenarioDetail) {
  const cups = detail.shifts.flatMap((s) => s.cups);
  return {
    n: cups.length,
    delighted: cups.filter((c) => c.reaction.reaction === "delighted").length,
    annoyed: cups.filter((c) => c.reaction.reaction === "annoyed").length,
  };
}

function storeRow(summary: ScenarioSummary, store: string) {
  return summary.by_store.find((s) => s.store === store) ?? null;
}

function call(manager: ScenarioDetail["managers"][number]) {
  if (manager.stance === "enforce_all" && manager.tracks_compliance) return "Required every cup, and checked.";
  if (manager.stance === "enforce_all") return "Required every cup.";
  if (manager.stance === "enforce_offpeak") return "Waived the rush.";
  if (manager.stance === "encourage" && !manager.tracks_compliance) return "Did not check, and let it go.";
  if (manager.stance === "encourage") return "Asked for the note.";
  if (manager.stance === "ignore") return "Let it go.";
  return "Decided.";
}

export default function CupNotesPage() {
  const project = getProjectBySlug(SLUG);
  if (!project) notFound();

  const index = getCupNotesIndex();
  const { meta } = index;
  const found = findings(index);
  const rush = readScenario(RUSH);
  const audit = strictRuleCountsAudit();
  const facesOnRush = rush ? faces(rush) : null;
  const commuter = rush ? groupOf(rush, "commuter") : null;
  const mobile = rush ? groupOf(rush, "mobile") : null;
  const regular = rush ? groupOf(rush, "regular") : null;
  const visitor = rush ? groupOf(rush, "tourist") : null;
  const dana = rush && found ? storeRow(found.strict, "drive-thru") : null;
  const mgr = (store: string) => rush?.managers.find((m) => m.store === store) ?? null;
  const danaMgr = mgr("drive-thru");
  const marcusMgr = mgr("office-tower");
  const rayMgr = mgr("airport");
  const tomMgr = mgr("mall-kiosk");
  const priyaMgr = mgr("campus");
  const jessMgr = mgr("neighborhood");
  const who = (store: string) => index.stores.find((s) => s.key === store)?.manager.name.split(" ")[0];
  const noteGap = found
    ? r0(found.strict.outcomes.compliance_pct) - r0(found.adaptive.outcomes.compliance_pct)
    : 0;
  const satGap = found
    ? r0(found.strict.outcomes.customer_satisfaction) - r0(found.adaptive.outcomes.customer_satisfaction)
    : 0;

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
            {found && (
              <>
                <p>
                  Starbucks has asked baristas to write a note on customers&rsquo; cups, and some
                  partners have objected that the requirement slows service when stores are
                  busiest. To size the trade-off, we simulated {found.scenarios} versions of the
                  policy across {index.stores.length} stores, varying four levers: how strictly the
                  rule is enforced, whether the note must be personal, traffic, and staffing.
                </p>
                <p>
                  Our analysis suggests that operators should not require a personal note during
                  short-staffed peak periods. Where the program is retained, a simple mark is
                  sufficient when the store is short-staffed, and note compliance should come off
                  the scorecard at drive-thru and airport stores while the line is long.
                </p>
                <p>
                  The economics of the base case illustrate why. During a short-staffed morning
                  rush, strict enforcement achieved note compliance of{" "}
                  {r0(found.strict.outcomes.compliance_pct)} percent, added{" "}
                  {found.strict.outcomes.avg_seconds_added.toFixed(1)} seconds per cup, and produced
                  a customer satisfaction score of{" "}
                  {r0(found.strict.outcomes.customer_satisfaction)}. Waiving the requirement during
                  the rush reduced compliance to {r0(found.adaptive.outcomes.compliance_pct)}{" "}
                  percent and the added time to{" "}
                  {found.adaptive.outcomes.avg_seconds_added.toFixed(1)} seconds, while satisfaction
                  held at {r0(found.adaptive.outcomes.customer_satisfaction)}. For comparison, a
                  quiet, fully staffed shift averaged {found.quietSat}.
                </p>
                <p>Three findings support this recommendation:</p>
                <ol>
                  <li>Operating conditions, not the note, determine customer satisfaction.</li>
                  <li>Manager incentives reshape the policy before it reaches the customer.</li>
                  <li>The program&rsquo;s measurable benefit is modest, and peak periods do not justify its cost.</li>
                </ol>

                <h2>Operating conditions, not the note, determine customer satisfaction</h2>
                <p>
                  Across every version of the policy, quiet, fully staffed shifts produced
                  satisfaction scores between {found.quietBand.lo} and {found.quietBand.hi}. During
                  the short-staffed rush, scores under strict, flexible, and adaptive enforcement
                  were {r0(found.strict.outcomes.customer_satisfaction)},{" "}
                  {r0(found.flexible.outcomes.customer_satisfaction)}, and{" "}
                  {r0(found.adaptive.outcomes.customer_satisfaction)}, respectively. Put
                  differently, a {noteGap}-percentage-point increase in note compliance yields{" "}
                  {satGap} {satGap === 1 ? "point" : "points"} of satisfaction.
                </p>
                {commuter && mobile && regular && facesOnRush && (
                  <p>
                    Customer-level results explain the gap. The base-case score of{" "}
                    {r0(found.strict.outcomes.customer_satisfaction)} averages {facesOnRush.n}{" "}
                    customers. Of {commuter.n} commuters, {commuter.noticed} noticed a note, and
                    their satisfaction averaged {commuter.sat}. Of {mobile.n} mobile-order
                    customers, {mobile.noticed} noticed one. Among {regular.n} regulars, the segment
                    the program most plausibly targets, {regular.noticed} noticed a note, and
                    connection averaged {regular.conn}.
                  </p>
                )}

                <h2>Manager incentives reshape the policy before it reaches the customer</h2>
                <p>
                  Even under strict enforcement, managers required a note on every cup in only{" "}
                  {found.enforceAll} of {found.managers} decisions. How each manager implemented
                  the policy tracked closely with how that manager is evaluated.
                </p>
                {danaMgr && marcusMgr && rayMgr && tomMgr && dana && (
                  <ul>
                    <li>
                      <strong>Drive-thru.</strong> {who("drive-thru")}, measured on a 45-second
                      service window and the audit,{" "}
                      {call(danaMgr).replace(/\.$/, "").toLowerCase()}. The store achieved{" "}
                      {r0(dana.compliance_pct)} percent compliance, with an average wait of{" "}
                      {dana.avg_wait_min.toFixed(1)} minutes.
                    </li>
                    <li>
                      <strong>Office tower.</strong> {who("office-tower")}, measured on throughput
                      and labor cost, {call(marcusMgr).replace(/\.$/, "").toLowerCase()}.
                    </li>
                    <li>
                      <strong>Airport.</strong> {who("airport")}, measured on speed,{" "}
                      {call(rayMgr).replace(/\.$/, "").toLowerCase()}.
                    </li>
                    <li>
                      <strong>Mall kiosk.</strong> {who("mall-kiosk")}, whose store is rarely
                      visited, {call(tomMgr).replace(/\.$/, "").toLowerCase()}.
                    </li>
                  </ul>
                )}
                {priyaMgr && jessMgr && (
                  <p>
                    The pattern held at the remaining stores: at the campus store,{" "}
                    {who("campus")} {call(priyaMgr).replace(/\.$/, "").toLowerCase()}, and at the
                    neighborhood store, {who("neighborhood")}{" "}
                    {call(jessMgr).replace(/\.$/, "").toLowerCase()}. In each case, the role
                    predicted the decision.
                  </p>
                )}
                {audit && danaMgr?.tracks_compliance && tomMgr && !tomMgr.tracks_compliance && (
                  <p>
                    The audit compounds this effect. A missed note counts against the store, yet the
                    policy does not specify the consequences of a failed audit. In practice,
                    compliance is tracked only where someone reviews it: {who("drive-thru")} did;{" "}
                    {who("mall-kiosk")} did not.
                  </p>
                )}

                <h2>The program&rsquo;s measurable benefit is modest, and peak periods do not justify its cost</h2>
                <p>
                  Across all {found.scenarios} scenarios, requiring a personal note produced a
                  connection score of {found.personalConn}, compared with {found.markConn} when any
                  mark counted. Satisfaction was {found.personalSat} and {found.markSat},
                  respectively. The personal note cost {found.personalSec.toFixed(1)} seconds per
                  cup, against {found.markSec.toFixed(1)} seconds for a mark.
                </p>
                <p>
                  The gap remains narrow even under the most favorable conditions. On a quiet, fully
                  staffed shift with strict enforcement, a personal note yielded satisfaction of{" "}
                  {r0(found.quietPersonal.outcomes.customer_satisfaction)}, versus{" "}
                  {r0(found.quietMark.outcomes.customer_satisfaction)} for a mark, and connection
                  of {r0(found.quietPersonal.outcomes.connection)}, versus{" "}
                  {r0(found.quietMark.outcomes.connection)}, at a cost of{" "}
                  {found.quietPersonal.outcomes.avg_seconds_added.toFixed(1)} seconds per cup,
                  versus {found.quietMark.outcomes.avg_seconds_added.toFixed(1)}.
                </p>
                <p>
                  Word of mouth, measured as the share of customers who would mention the visit to
                  someone else, was {r0(found.strict.outcomes.would_mention_pct)} percent under
                  strict enforcement during the rush and{" "}
                  {r0(found.adaptive.outcomes.would_mention_pct)} percent when the requirement was
                  waived.
                  {visitor && mobile && (
                    <>
                      {" "}
                      Of {visitor.n} visitors, {visitor.mention} would mention it; of {mobile.n}{" "}
                      mobile-order customers, {mobile.mention} would.
                    </>
                  )}
                </p>
                <p>
                  Finally, waiving the requirement does not by itself relieve frontline pressure.
                  Partner stress registered {found.stress.lo}
                  {found.stress.lo === found.stress.hi ? "" : ` to ${found.stress.hi}`} in every
                  short-staffed rush scenario, regardless of enforcement.
                </p>

                <h2>Implications for operators</h2>
                <ul>
                  <li>
                    <strong>Waive the personal-note requirement during short-staffed peaks.</strong>{" "}
                    The satisfaction benefit is {satGap} {satGap === 1 ? "point" : "points"}, while
                    the time cost is incurred precisely when the line is longest.
                  </li>
                  <li>
                    <strong>Accept a simple mark where the gesture is retained.</strong> It delivers
                    a connection score of {found.markConn}, against {found.personalConn} for a
                    personal note, at {found.markSec.toFixed(1)} seconds per cup rather than{" "}
                    {found.personalSec.toFixed(1)}.
                  </li>
                  <li>
                    <strong>Align the scorecard with the store format.</strong> Managers at
                    drive-thru and airport stores are measured on speed; a peak-period note target
                    asks them to make a trade-off the policy does not acknowledge.
                  </li>
                </ul>
              </>
            )}
          </div>

          <div className="prose-post mt-10">
            <p>
              The interactive exhibit below opens on the base case: strict enforcement, a personal
              note, and a short-staffed morning rush. Adjust the levers to compare scenarios.
            </p>
          </div>

          {/*
            The demo widens past the 42rem measure: to 60rem from `lg` and 72rem from `xl`, where
            the viewport has room for three manager cards and a shift row on one line. Below `lg`
            it sits in the prose column and stacks.
          */}
          <section className="mt-6 lg:-mx-[10.5rem] xl:-mx-[16.5rem]">
            <CupNotesDemo index={index} />
          </section>

          <p className="mt-10 border-t border-[var(--color-border-warm)] pt-6 text-xs leading-6 text-[var(--color-muted)]">
            On the policy:{" "}
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
