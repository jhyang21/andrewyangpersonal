import {
  PARAM_RANGES,
  type EnumParamMeta,
  type NumericParamMeta,
  type Settings,
  type VizToggles,
} from "@/lib/shape-lab/types";
import { Select, Slider, Toggle } from "./controls";

type Props = {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  viz: VizToggles;
  onVizChange: (key: keyof VizToggles, value: boolean) => void;
};

type NumericKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];
type EnumKey = { [K in keyof Settings]: Settings[K] extends string ? K : never }[keyof Settings];

const VIZ_LABELS: { key: keyof VizToggles; label: string }[] = [
  { key: "silhouette", label: "Silhouette" },
  { key: "fillSilhouette", label: "Fill" },
  { key: "skeleton", label: "Skeleton" },
  { key: "points", label: "Points" },
  { key: "pointLabels", label: "Point labels" },
  { key: "ellipseAxes", label: "Ellipse axes" },
  { key: "construction", label: "Construction" },
  { key: "centroid", label: "Centroid" },
  { key: "contactRegion", label: "Contact region" },
  { key: "balancedPose", label: "Balanced pose" },
  { key: "intersections", label: "Intersections" },
  { key: "boundingBox", label: "Bounding box" },
  { key: "domainSquare", label: "Domain square" },
];

export function ParamPanel({ settings, onChange, viz, onVizChange }: Props) {
  const numeric = (key: NumericKey, onValue?: (value: number) => void) => {
    const meta = PARAM_RANGES[key] as NumericParamMeta;
    return (
      <Slider
        key={key}
        label={meta.label}
        description={meta.description}
        value={settings[key]}
        min={meta.min}
        max={meta.max}
        step={meta.step}
        onChange={onValue ?? ((value) => onChange({ [key]: value } as Partial<Settings>))}
      />
    );
  };

  const choice = (key: EnumKey) => {
    const meta = PARAM_RANGES[key] as EnumParamMeta<string>;
    return (
      <Select
        key={key}
        label={meta.label}
        description={meta.description}
        value={settings[key]}
        options={meta.options}
        optionLabels={meta.optionLabels}
        onChange={(value) => onChange({ [key]: value } as Partial<Settings>)}
      />
    );
  };

  const { radiusMode, arcSideMode } = settings;
  const usesBounds = radiusMode === "uniform" || radiusMode === "heavyTail";

  return (
    <div className="sl-panel">
      <details className="sl-section" open>
        <summary>Points</summary>
        <div className="sl-section-body">
          {numeric("pointCount")}
          {choice("pointDistribution")}
          {settings.pointDistribution === "clustered" && numeric("clusterCount")}
          {numeric("margin")}
        </div>
      </details>

      <details className="sl-section" open>
        <summary>Path</summary>
        <div className="sl-section-body">
          {choice("startMode")}
          {numeric("closingEdgeWeight")}
          <p className="sl-note">Every tour is untangled to a simple polygon.</p>
        </div>
      </details>

      <details className="sl-section" open>
        <summary>Curves</summary>
        <div className="sl-section-body">
          {choice("curveStyle")}
          {choice("radiusMode")}
          {radiusMode === "fixed" && numeric("radiusScale")}
          {/*
            The two bounds are kept ordered on the way in: dragging one past the other pushes it
            rather than inverting the pair, so a slider never sits left of its own minimum.
          */}
          {usesBounds &&
            numeric("radiusMin", (value) =>
              onChange({ radiusMin: value, radiusMax: Math.max(value, settings.radiusMax) }),
            )}
          {usesBounds &&
            numeric("radiusMax", (value) =>
              onChange({ radiusMax: value, radiusMin: Math.min(value, settings.radiusMin) }),
            )}
          {radiusMode === "heavyTail" && numeric("radiusTailPower")}
          {radiusMode === "gaussian" && numeric("radiusMean")}
          {radiusMode === "gaussian" && numeric("radiusVariation")}
          {choice("arcSideMode")}
          {arcSideMode === "switchProbability" && numeric("switchProbability")}
          {arcSideMode === "spatialBias" && choice("biasDirection")}
          {arcSideMode === "spatialBias" && numeric("biasStrength")}
          {numeric("arcResolution")}
        </div>
      </details>

      <details className="sl-section" open>
        <summary>Geometry constraints</summary>
        <div className="sl-section-body">
          {numeric("minimumClearance")}
          {numeric("safeRadiusFactor")}
          {numeric("bulgeAggressiveness")}
          {numeric("sideSpaceBias")}
          {numeric("curveGrowthPasses")}
          <details className="sl-subsection">
            <summary>Solver budgets</summary>
            <div className="sl-section-body">
              {numeric("maxUntangleIterations")}
              {numeric("safeRadiusSearchIterations")}
              {numeric("maxArcRepairAttempts")}
            </div>
          </details>
        </div>
      </details>

      <details className="sl-section" open>
        <summary>Balance</summary>
        <div className="sl-section-body">{numeric("contactTolerance")}</div>
      </details>

      <details className="sl-section" open>
        <summary>Exploration</summary>
        <div className="sl-section-body">
          {numeric("mutationAmount")}
          {numeric("searchCandidates")}
        </div>
      </details>

      <details className="sl-section" open>
        <summary>Show</summary>
        <div className="sl-section-body sl-viz-grid">
          {VIZ_LABELS.map((item) => (
            <Toggle
              key={item.key}
              label={item.label}
              checked={viz[item.key]}
              onChange={(value) => onVizChange(item.key, value)}
            />
          ))}
        </div>
      </details>
    </div>
  );
}
