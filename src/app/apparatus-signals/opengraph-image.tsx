import { ImageResponse } from "next/og";
import { getMeta, stageTotals } from "@/apparatus-signals/lib/data";
import { formatDate, formatNumber } from "@/apparatus-signals/lib/format";
import { SITE_BYLINE, SITE_NAME, SITE_QUESTION } from "@/apparatus-signals/lib/site";

export const alt = `${SITE_NAME}: ${SITE_QUESTION}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const meta = getMeta();
  const t = stageTotals();
  const stats: [string, string][] = [
    [formatNumber(t.not_listed_soon), "to call before they list"],
    [formatNumber(t.listed), "at auction now"],
    [formatNumber(t.sold), "sold since May"],
  ];
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
          background: "#fcfcfb",
          color: "#0b0b0b",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#52514e" }}>
          {SITE_NAME} {SITE_BYLINE}
        </div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
          {SITE_QUESTION}?
        </div>
        <div style={{ display: "flex", gap: 64, alignItems: "flex-end" }}>
          {stats.map(([n, label]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 56, fontWeight: 700, color: "#1c5cab" }}>{n}</div>
              <div style={{ fontSize: 24, color: "#52514e" }}>{label}</div>
            </div>
          ))}
          <div style={{ display: "flex", marginLeft: "auto", fontSize: 24, color: "#52514e" }}>
            Updated {formatDate(meta.updated)}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
