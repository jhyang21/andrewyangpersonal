import Link from "next/link";
import { LEVER_ORDER, scenarioKey } from "@/cup-notes/lib/levers";
import { runHref } from "@/cup-notes/lib/site";
import type { CupNotesIndex, LeverSelection } from "@/cup-notes/lib/types";
import { LEVER_TITLES } from "@/cup-notes/lib/words";

type Props = {
  index: CupNotesIndex;
  selection: LeverSelection;
};

/*
 * The four levers as plain links between run pages. Each option points at the run that differs from
 * this one in that lever alone; the current option is marked as the current page. Server component:
 * no client JavaScript, and Next prefetches the neighbours.
 */
export function LeverPicker({ index, selection }: Props) {
  return (
    <nav className="cn-levers" aria-label="Pick a run">
      {LEVER_ORDER.map((lever) => (
        <div key={lever} className="cn-lever" role="group" aria-labelledby={`cn-lever-${lever}`}>
          <p id={`cn-lever-${lever}`} className="cn-seg-legend">
            {LEVER_TITLES[lever]}
          </p>
          <div className="cn-seg-track">
            {index.levers[lever].map((o) => {
              const on = selection[lever] === o.key;
              return (
                <Link
                  key={o.key}
                  href={runHref(scenarioKey({ ...selection, [lever]: o.key }))}
                  className={`cn-seg ${on ? "cn-seg-on" : ""}`}
                  aria-current={on ? "page" : undefined}
                  scroll={false}
                >
                  <span className="cn-seg-label">{o.label}</span>
                  <span className="cn-seg-short">{o.short}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
