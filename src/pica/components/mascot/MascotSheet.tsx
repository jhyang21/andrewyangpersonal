import { Pica } from "./Pica";
import { PICA_POSES, type PicaPose } from "./poses";

/** What each pose tells the buyer (docs/PICA-DESIGN.md section 4). */
export const POSE_MEANING: Record<PicaPose, string> = {
  idle: "Ready",
  listening: "You are typing; Pica attends",
  thinking: "Pica is working",
  found: "Options are ready",
  weighing: "Two or more things side by side",
  unsure: "A gap or a fault",
  resting: "Paused or put down",
  settled: "A decision is made, bought or not",
};

export const SHEET_SIZES = [24, 48, 120] as const;

/** The one size whose thinking bird loops; the others hold still. */
const MOVING_SIZE = 48;

/**
 * Every pose at every sheet size, for the kit page. Pica stays hidden from
 * screen readers, so each row names its pose in text.
 */
export function MascotSheet({ className }: { className?: string }) {
  return (
    <table className={["pica-mascot-sheet border-collapse text-left text-body text-ink", className ?? ""].join(" ").trim()}>
      <caption className="pb-3 text-left text-body text-ink">
        Pica&apos;s eight poses at {SHEET_SIZES.join(", ")} px
      </caption>
      <thead>
        <tr>
          <th scope="col" className="py-2 pr-6 font-semibold">
            Pose
          </th>
          {SHEET_SIZES.map((size) => (
            <th key={size} scope="col" className="py-2 pr-6 font-semibold">
              {size}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {PICA_POSES.map((pose) => (
          <tr key={pose} className="border-t border-hairline">
            <th scope="row" className="py-3 pr-6 align-middle font-normal">
              <span className="block font-semibold">{pose}</span>
              <span className="block text-caption text-ink">{POSE_MEANING[pose]}</span>
            </th>
            {SHEET_SIZES.map((size) => (
              <td key={size} className="py-3 pr-6 align-middle">
                {/* The row's text names the pose, so the birds stay quiet. One thinking bird moves. */}
                <Pica pose={pose} size={size} label={null} still={size !== MOVING_SIZE} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
