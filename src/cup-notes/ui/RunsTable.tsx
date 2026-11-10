import Link from "next/link";
import { scenarioName } from "@/cup-notes/lib/levers";
import { runHref } from "@/cup-notes/lib/site";
import type { CupNotesIndex } from "@/cup-notes/lib/types";

type Props = {
  index: CupNotesIndex;
  /** The run on screen, marked in the table. */
  highlight?: string;
};

/** Every run as one row, each a link to its page. Server component. */
export function RunsTable({ index, highlight }: Props) {
  return (
    <div className="cn-table-wrap">
      <table className="cn-table">
        <caption className="cn-table-caption">All {index.scenarios.length} runs</caption>
        <thead>
          <tr>
            <th scope="col">Run</th>
            <th scope="col">Compliance %</th>
            <th scope="col">Personal %</th>
            <th scope="col">Added s per cup</th>
            <th scope="col">Avg wait min</th>
            <th scope="col">Barista sentiment</th>
            <th scope="col">Satisfaction</th>
            <th scope="col">Connection</th>
          </tr>
        </thead>
        <tbody>
          {index.scenarios.map((s) => {
            const now = s.key === highlight;
            return (
              <tr key={s.key} className={now ? "cn-table-now" : undefined}>
                <th scope="row">
                  <Link href={runHref(s.key)} aria-current={now ? "page" : undefined}>
                    {scenarioName(index, s.levers)}
                  </Link>
                </th>
                <td>{s.outcomes.compliance_pct.toFixed(1)}</td>
                <td>{s.outcomes.personal_pct.toFixed(1)}</td>
                <td>{s.outcomes.avg_seconds_added.toFixed(1)}</td>
                <td>{s.outcomes.avg_wait_min.toFixed(1)}</td>
                <td>{s.outcomes.barista_sentiment.toFixed(1)}</td>
                <td>{s.outcomes.customer_satisfaction.toFixed(1)}</td>
                <td>{s.outcomes.connection.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
