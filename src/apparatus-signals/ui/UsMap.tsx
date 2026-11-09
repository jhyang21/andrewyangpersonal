"use client";

import { useRef, useState } from "react";
import { formatNumber, plural } from "@/apparatus-signals/lib/format";
import { BASE } from "@/apparatus-signals/lib/site";
import { DC_DOT, INSET_SEPARATOR, US_STATE_PATHS, US_VIEWBOX } from "./us-paths";

export interface MapState {
  code: string;
  name: string;
  leads: number;
  rate: number; // leads per 100 registry departments
  bin: number; // 0 = no leads, 1..5
  deep: boolean;
  coverageName: string;
}

interface Tip {
  state: MapState;
  x: number;
  y: number;
  maxX: number;
}

function describe(s: MapState): string {
  return `${s.name}: ${plural(s.leads, "lead")}, ${s.rate.toFixed(1)} per 100 departments. ${s.coverageName}.`;
}

export default function UsMap({ states }: { states: MapState[] }) {
  const byCode = new Map(states.map((s) => [s.code, s]));
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  function show(s: MapState, clientX: number, clientY: number) {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ state: s, x: clientX - box.left, y: clientY - box.top, maxX: box.width - 230 });
  }

  function showAtElement(s: MapState, el: Element) {
    const r = el.getBoundingClientRect();
    show(s, r.left + r.width / 2, r.top + r.height / 2);
  }

  const shapes = [
    ...US_STATE_PATHS.map((p) => ({ ...p, kind: "path" as const })),
    { ...DC_DOT, kind: "dot" as const },
  ];

  return (
    <div ref={wrap} className="relative" onPointerLeave={() => setTip(null)}>
      <svg
        viewBox={US_VIEWBOX}
        className="us-map block h-auto w-full"
        role="group"
        aria-label="Map of leads per 100 fire departments by state. Each state links to its page."
      >
        <path className="sep" d={INSET_SEPARATOR} aria-hidden="true" />
        {shapes.map((shape) => {
          const s = byCode.get(shape.code);
          if (!s) return null;
          const cls = `state fill-${s.bin}${s.deep ? " deep" : ""}`;
          return (
            <a
              key={shape.code}
              href={`${BASE}/${shape.code.toLowerCase()}`}
              aria-label={describe(s)}
              onPointerMove={(e) => show(s, e.clientX, e.clientY)}
              onFocus={(e) => showAtElement(s, e.currentTarget)}
              onBlur={() => setTip(null)}
            >
              {shape.kind === "path" ? (
                <path className={cls} d={shape.d} />
              ) : (
                <circle className={cls} cx={shape.cx} cy={shape.cy} r={shape.r + 2} />
              )}
            </a>
          );
        })}
        {/* Deep states drawn again on top so the thick outline is not covered by neighbours. */}
        {US_STATE_PATHS.filter((p) => byCode.get(p.code)?.deep).map((p) => (
          <path
            key={`deep-${p.code}`}
            d={p.d}
            fill="none"
            stroke="var(--as-deep-outline)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            pointerEvents="none"
            aria-hidden="true"
          />
        ))}
      </svg>
      {tip ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 w-56 rounded border border-as-rule bg-as-bg p-2 text-sm shadow-md"
          style={{
            left: Math.max(0, Math.min(tip.x + 12, tip.maxX)),
            top: tip.y + 12,
          }}
        >
          <p className="font-semibold">{tip.state.name}</p>
          <p>
            <span className="num font-semibold">{formatNumber(tip.state.leads)}</span>{" "}
            <span className="text-as-ink-2">
              {tip.state.leads === 1 ? "lead" : "leads"} · {tip.state.rate.toFixed(1)} per 100 departments
            </span>
          </p>
          <p className="text-as-ink-2">{tip.state.coverageName}</p>
        </div>
      ) : null}
    </div>
  );
}
