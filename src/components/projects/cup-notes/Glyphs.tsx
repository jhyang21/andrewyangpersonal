import type { CupAction, Reaction } from "@/lib/cup-notes/types";

/*
 * Two small glyphs the whole demo shares. Colour comes from the `--cn-*` variables in cup-notes.css;
 * the marks inside each glyph carry the same meaning a second way, so neither the cups nor the faces
 * depend on colour alone: a smiley cup has a smiley, a generic note one written line, a personal note
 * two; each face has its own mouth.
 */

export function CupGlyph({ action, empty = false }: { action: CupAction; empty?: boolean }) {
  const cls = empty ? "cn-cup-empty" : `cn-cup-${action}`;
  return (
    <svg className={`cn-cup ${cls}`} viewBox="0 0 20 26" aria-hidden="true">
      <rect className="cn-cup-lid" x="1.5" y="1.5" width="17" height="4" rx="1.5" />
      <path className="cn-cup-body" d="M3.2 5.5h13.6l-1.6 18.2a1.5 1.5 0 0 1-1.5 1.3H6.3a1.5 1.5 0 0 1-1.5-1.3z" />
      {!empty && action === "smiley" && (
        <g className="cn-cup-mark">
          <circle cx="8.2" cy="12.3" r="0.9" />
          <circle cx="11.8" cy="12.3" r="0.9" />
          <path d="M7.4 15.2q2.6 2.6 5.2 0" fill="none" />
        </g>
      )}
      {!empty && action === "generic" && (
        <path className="cn-cup-mark" d="M6.6 14.8q1.15-1.4 2.3 0t2.3 0 2.3 0" fill="none" />
      )}
      {!empty && action === "personal" && (
        <g className="cn-cup-mark" fill="none">
          <path d="M6.4 12.4q1.2-1.4 2.4 0t2.4 0 2.4 0" />
          <path d="M6.9 17.2q1.05-1.3 2.1 0t2.1 0" />
        </g>
      )}
    </svg>
  );
}

const MOUTHS: Record<Reaction, string> = {
  delighted: "M7 11.2h10a5 5 0 0 1-10 0z",
  warm: "M7.6 13q4.4 3.6 8.8 0",
  neutral: "M8 14.4h8",
  indifferent: "M8 15l8-1.4",
  annoyed: "M7.8 16.2q4.2-3.4 8.4 0",
};

export function FaceGlyph({ reaction, empty = false }: { reaction: Reaction; empty?: boolean }) {
  return (
    <svg
      className={`cn-face ${empty ? "cn-face-empty" : `cn-face-${reaction}`}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="cn-face-disc" cx="12" cy="12" r="10.5" />
      {!empty && (
        <g className="cn-face-mark">
          <circle cx="8.7" cy="9.2" r="1.2" />
          <circle cx="15.3" cy="9.2" r="1.2" />
          <path
            d={MOUTHS[reaction]}
            fill={reaction === "delighted" ? undefined : "none"}
          />
        </g>
      )}
    </svg>
  );
}
