import { ImageResponse } from "next/og";
import { getIndex } from "@/cup-notes/lib/data";
import { findings } from "@/cup-notes/lib/findings";
import { formatDate, formatNumber } from "@/cup-notes/lib/format";
import { SITE_BYLINE, SITE_NAME, SITE_QUESTION } from "@/cup-notes/lib/site";

export const alt = `${SITE_NAME}: ${SITE_QUESTION}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Hard-coded light colours: the image has no theme. Ground, ink, muted and green match the tokens. */
export default function Image() {
  const index = getIndex();
  const { meta } = index;
  const f = findings(index);
  const stats: [string, string][] = [[formatNumber(meta.counts.scenarios), "versions of the rule"]];
  if (f) {
    stats.push(
      [`${f.enforceAll} of ${f.managers}`, "managers enforced the strict rule on every cup"],
      [`${f.slammedSat} vs ${f.quietSat}`, "satisfaction, short-staffed rush vs quiet shift"],
    );
  }
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#F6F1E8",
          color: "#1A1A1A",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#6F675C" }}>
          {SITE_NAME} {SITE_BYLINE}
        </div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
          {SITE_QUESTION}?
        </div>
        <div style={{ display: "flex", gap: 56, alignItems: "flex-end" }}>
          {stats.map(([n, label]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", maxWidth: 300 }}>
              <div style={{ fontSize: 56, fontWeight: 700, color: "#4A7336" }}>{n}</div>
              <div style={{ fontSize: 24, color: "#6F675C" }}>{label}</div>
            </div>
          ))}
          <div style={{ display: "flex", marginLeft: "auto", fontSize: 24, color: "#6F675C" }}>
            {formatDate(meta.generated_at)}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
