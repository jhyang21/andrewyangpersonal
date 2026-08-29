"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateShape,
  mutateSettings,
  randomizeSettings,
  scoreCandidateRange,
  toStandaloneSvg,
  toSvgPathD,
  type Locks,
} from "@/lib/shape-lab/engine";
import { PRESET_IDS, PRESETS, type PresetId } from "@/lib/shape-lab/presets";
import { mulberry32, parseSeed } from "@/lib/shape-lab/rng";
import {
  DEFAULT_SETTINGS,
  DEFAULT_VIZ,
  type Settings,
  type Shape,
  type VizToggles,
} from "@/lib/shape-lab/types";
import { ParamPanel } from "./ParamPanel";
import { SeedField, Toggle } from "./controls";
import { StatsPanel } from "./StatsPanel";
import { Viewport } from "./Viewport";
import "./shape-lab.css";

/** Long enough that a slider drag generates a handful of shapes, short enough to feel live. */
const DEBOUNCE_MS = 70;
/** Candidates scored between timeouts. Bounds how long one synchronous scoring slice blocks the main thread, sized for phone CPUs. */
const SEARCH_CHUNK = 60;
const COPY_FEEDBACK_MS = 1200;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

/**
 * The engine reads the bulge bounds as an unordered pair, but a slider cannot draw one. Randomize
 * and mutate both move the two independently, so the pair is re-ordered before it reaches state.
 */
function orderRadius(settings: Settings): Settings {
  if (settings.radiusMin <= settings.radiusMax) return settings;
  return { ...settings, radiusMin: settings.radiusMax, radiusMax: settings.radiusMin };
}

function locksFor(shape: Shape, lockPoints: boolean, lockPath: boolean): Locks {
  if (lockPath) return { points: shape.points, pathOrder: shape.pathOrder };
  if (lockPoints) return { points: shape.points };
  return null;
}

type Current = { shape: Shape; generation: number };

export function ShapeLab() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [seed, setSeed] = useState(1);
  const [seedText, setSeedText] = useState("1");
  const [lockPoints, setLockPoints] = useState(false);
  const [lockPath, setLockPath] = useState(false);
  const [viz, setViz] = useState<VizToggles>(DEFAULT_VIZ);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [copied, setCopied] = useState(false);

  /*
   * The engine is a pure function of (seed, settings, locks) and touches neither the clock nor
   * Math.random, so the server renders this first shape and the client hydrates the identical one.
   */
  const [current, setCurrent] = useState<Current>(() => ({
    shape: generateShape(1, DEFAULT_SETTINGS, null),
    generation: 0,
  }));

  const debouncedSettings = useDebouncedValue(settings, DEBOUNCE_MS);

  // Locks read the displayed shape, which is this effect's own output — a ref, so reading it never
  // becomes a dependency and never loops.
  const shapeRef = useRef(current.shape);
  const searchTimer = useRef<number | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    shapeRef.current = current.shape;
  }, [current.shape]);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const shape = generateShape(
      seed,
      debouncedSettings,
      locksFor(shapeRef.current, lockPoints, lockPath),
    );
    setCurrent((prev) => ({ shape, generation: prev.generation + 1 }));
  }, [debouncedSettings, seed, lockPoints, lockPath]);

  const cancelSearch = useCallback(() => {
    if (searchTimer.current !== null) {
      window.clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
  }, []);

  useEffect(() => cancelSearch, [cancelSearch]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [copied]);

  const applySeed = useCallback((value: number) => {
    setSeed(value);
    setSeedText(String(value));
  }, []);

  const commitSeed = useCallback(() => {
    // Anything that isn't an integer is hashed, so "beaver" is as good a seed as 41.
    applySeed(parseSeed(seedText));
  }, [applySeed, seedText]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const setVizKey = useCallback((key: keyof VizToggles, value: boolean) => {
    setViz((prev) => ({ ...prev, [key]: value }));
  }, []);

  // The same seed and settings always give the same shape, so a redraw needs a new seed to mean
  // anything. Stepping by one makes the previous-seed button an undo.
  const regenerate = useCallback(() => applySeed(seed + 1), [applySeed, seed]);

  const randomize = useCallback(() => {
    setSettings((prev) => orderRadius(randomizeSettings(prev, mulberry32(randomSeed()))));
    applySeed(randomSeed());
  }, [applySeed]);

  const mutate = useCallback(() => {
    setSettings((prev) =>
      orderRadius(mutateSettings(prev, prev.mutationAmount, mulberry32(randomSeed()))),
    );
  }, []);

  const applyPreset = useCallback((id: PresetId) => {
    setSettings((prev) => orderRadius({ ...prev, ...PRESETS[id].settings }));
  }, []);

  const handleLockPath = useCallback((value: boolean) => {
    setLockPath(value);
    // Reusing a path order without its points is meaningless — the order indexes them.
    if (value) setLockPoints(true);
  }, []);

  /*
   * Candidates are scored at a low arc resolution in chunks between timeouts, so a two-thousand-seed
   * sweep never blocks a keystroke. Only the winner is rebuilt at full resolution, by the ordinary
   * generation effect once its seed lands in state. The window starts one past the current seed, so
   * the current shape never competes in its own search and every click lands on a new shape.
   */
  const runSearch = useCallback(() => {
    if (searchTimer.current !== null) return;
    const total = Math.max(1, Math.round(debouncedSettings.searchCandidates));
    const baseSeed = seed + 1;
    const locks = locksFor(shapeRef.current, lockPoints, lockPath);
    let best = { bestSeed: baseSeed, bestScore: -Infinity };
    let index = 0;

    const step = () => {
      const end = Math.min(total, index + SEARCH_CHUNK);
      const result = scoreCandidateRange(baseSeed, debouncedSettings, locks, index, end);
      if (result.bestScore > best.bestScore) best = result;
      index = end;
      if (index < total) {
        setProgress({ done: index, total });
        searchTimer.current = window.setTimeout(step, 0);
        return;
      }
      searchTimer.current = null;
      setProgress(null);
      applySeed(best.bestSeed);
    };

    setProgress({ done: 0, total });
    searchTimer.current = window.setTimeout(step, 0);
  }, [applySeed, debouncedSettings, lockPath, lockPoints, seed]);

  const exportSvg = useCallback(() => {
    const blob = new Blob([toStandaloneSvg(current.shape)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shape-${current.shape.seed}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }, [current.shape]);

  const copyPath = useCallback(() => {
    navigator.clipboard.writeText(toSvgPathD(current.shape.silhouette)).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }, [current.shape]);

  const searching = progress !== null;

  return (
    <div className="sl-shell">
      <header className="sl-wordmark">Unconventional Shape Lab</header>

      <div className="sl-grid">
        <section className="sl-stage">
          <div className="sl-canvas">
            <Viewport key={current.generation} shape={current.shape} viz={viz} />
          </div>
          <StatsPanel
            shape={current.shape}
            onExport={exportSvg}
            onCopy={copyPath}
            copied={copied}
          />
        </section>

        <aside className="sl-side">
          <div className="sl-block">
            <div className="sl-actions">
              <button type="button" className="sl-btn sl-btn-primary" onClick={regenerate}>
                Regenerate
              </button>
              <button type="button" className="sl-btn" onClick={randomize}>
                Randomize
              </button>
              <button type="button" className="sl-btn" onClick={mutate}>
                Mutate
              </button>
              <button
                type="button"
                className="sl-btn sl-btn-wide"
                onClick={runSearch}
                disabled={searching}
              >
                {progress
                  ? `Searching… ${progress.done}/${progress.total}`
                  : "Find precarious"}
              </button>
            </div>
          </div>

          <div className="sl-block">
            <span className="sl-field-label">Seed</span>
            <div className="sl-seed-row">
              <SeedField text={seedText} onTextChange={setSeedText} onCommit={commitSeed} />
              <button
                type="button"
                className="sl-btn sl-btn-icon"
                aria-label="Previous seed"
                onClick={() => applySeed(seed - 1)}
              >
                −
              </button>
              <button
                type="button"
                className="sl-btn sl-btn-icon"
                aria-label="Next seed"
                onClick={() => applySeed(seed + 1)}
              >
                +
              </button>
              <button type="button" className="sl-btn" onClick={() => applySeed(randomSeed())}>
                Random
              </button>
            </div>
          </div>

          <div className="sl-block">
            <span className="sl-field-label">Presets</span>
            <div className="sl-chips">
              {PRESET_IDS.map((id) => (
                <button
                  type="button"
                  key={id}
                  className="sl-chip"
                  onClick={() => applyPreset(id)}
                >
                  {PRESETS[id].label}
                </button>
              ))}
            </div>
          </div>

          <div className="sl-block">
            <span className="sl-field-label">Locks</span>
            <Toggle
              label="Lock points"
              checked={lockPoints || lockPath}
              disabled={lockPath}
              onChange={setLockPoints}
            />
            <Toggle label="Lock path" checked={lockPath} onChange={handleLockPath} />
          </div>

          <ParamPanel
            settings={settings}
            onChange={updateSettings}
            viz={viz}
            onVizChange={setVizKey}
          />
        </aside>
      </div>
    </div>
  );
}
