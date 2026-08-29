/**
 * Shape Lab data model. Every type here is plain JSON data so a whole run can be
 * serialised, stored, and replayed without loss.
 */

export type Vec = { x: number; y: number };

export type PointDistribution = "uniform" | "center" | "edge" | "clustered";
export type StartMode = "lowest" | "highest" | "leftmost" | "rightmost" | "random";
export type RadiusMode = "fixed" | "uniform" | "gaussian" | "heavyTail";
export type ArcSideMode = "same" | "alternate" | "random" | "switchProbability" | "spatialBias";
export type BiasDirection = "up" | "down" | "left" | "right" | "outward" | "inward";
export type CurveStyle = "ellipse" | "bezier";

export type Settings = {
  // Stage 1 — points
  pointCount: number;
  pointDistribution: PointDistribution;
  margin: number;
  clusterCount: number;

  // Stage 2 — path topology
  startMode: StartMode;
  closingEdgeWeight: number;

  // Stage 3 — arcs
  curveStyle: CurveStyle;
  radiusMode: RadiusMode;
  radiusScale: number;
  radiusMin: number;
  radiusMax: number;
  radiusMean: number;
  radiusVariation: number;
  radiusTailPower: number;
  arcSideMode: ArcSideMode;
  switchProbability: number;
  biasDirection: BiasDirection;
  biasStrength: number;
  arcResolution: number;

  // Stage 3b — geometry constraints
  minimumClearance: number;
  safeRadiusFactor: number;
  bulgeAggressiveness: number;
  sideSpaceBias: number;
  curveGrowthPasses: number;
  maxUntangleIterations: number;
  safeRadiusSearchIterations: number;
  maxArcRepairAttempts: number;

  // Stage 4 — balance
  contactTolerance: number;

  // Exploration
  mutationAmount: number;
  searchCandidates: number;
};

export const DEFAULT_SETTINGS: Settings = {
  pointCount: 9,
  pointDistribution: "uniform",
  margin: 0.08,
  clusterCount: 3,

  startMode: "lowest",
  closingEdgeWeight: 0,

  curveStyle: "ellipse",
  radiusMode: "uniform",
  radiusScale: 0.4,
  radiusMin: 0.15,
  radiusMax: 0.8,
  radiusMean: 0.4,
  radiusVariation: 0.15,
  radiusTailPower: 4,
  arcSideMode: "switchProbability",
  switchProbability: 0.25,
  biasDirection: "up",
  biasStrength: 0.6,
  arcResolution: 24,

  minimumClearance: 0.012,
  safeRadiusFactor: 0.92,
  bulgeAggressiveness: 0.5,
  sideSpaceBias: 0,
  curveGrowthPasses: 5,
  maxUntangleIterations: 500,
  safeRadiusSearchIterations: 12,
  maxArcRepairAttempts: 30,

  contactTolerance: 0.04,

  mutationAmount: 0.15,
  searchCandidates: 100,
};

/** side is the sign of the half-ellipse bulge relative to the edge normal. */
export type ArcProps = { k: number; side: 1 | -1 };

/** What the solver did to one edge: what was drawn, what fit, and how much room was left. */
export type ArcReport = {
  edge: number;
  from: number;
  to: number;
  length: number;
  side: 1 | -1;
  preferredSide: 1 | -1;
  sideFlipped: boolean;
  kDesired: number;
  kActual: number;
  kSafe: number;
  kSafeOpposite: number;
  utilization: number;
  constrained: boolean;
  minClearance: number;
};

/** Solver outcome for the whole silhouette. `valid` is the hard guarantee; the rest is diagnosis. */
export type ConstraintReport = {
  arcs: ArcReport[];
  effectiveClearance: number;
  minClearance: number;
  meanUtilization: number;
  maxUtilization: number;
  constrainedCount: number;
  sideFlipCount: number;
  neckPairs: number;
  repairs: number;
  /** 0 clean · 1 local repairs · 2 re-solve · 3 global shrink · 4 near-flat · 5 skeleton polygon. */
  fallbackLevel: number;
  untangleIterations: number;
  pointRetries: number;
  growthPasses: number;
  solveResolution: number;
  clearanceViolations: number;
  valid: boolean;
};

export type Bbox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

/** Horizontal span of the silhouette that touches the ground line. */
export type ContactRegion = {
  minX: number;
  maxX: number;
  centerX: number;
  width: number;
  y: number;
};

export type PrecariousnessPart = { label: string; value: number; weight: number };

export type BalanceMetrics = {
  area: number;
  centroid: Vec;
  bbox: Bbox;
  contact: ContactRegion;
  centroidOffset: number;
  supported: boolean;
  contactNarrowness: number;
  topHeavyScore: number;
  slenderness: number;
  asymmetry: number;
  overhang: number;
  dramaticBulges: number;
  geometricTension: number;
  precariousness: number;
  precariousnessParts: PrecariousnessPart[];
};

export type Shape = {
  seed: number;
  settings: Settings;
  points: Vec[];
  pathOrder: number[];
  arcs: ArcProps[];
  constraints: ConstraintReport;
  silhouette: Vec[];
  pathIntersections: number;
  silhouetteIntersections: Vec[];
  attemptsUsed: number;
  metrics: BalanceMetrics;
};

export type VizToggles = {
  silhouette: boolean;
  fillSilhouette: boolean;
  points: boolean;
  pointLabels: boolean;
  skeleton: boolean;
  ellipseAxes: boolean;
  construction: boolean;
  domainSquare: boolean;
  centroid: boolean;
  contactRegion: boolean;
  intersections: boolean;
  boundingBox: boolean;
};

export const DEFAULT_VIZ: VizToggles = {
  silhouette: true,
  fillSilhouette: true,
  points: false,
  pointLabels: false,
  skeleton: false,
  ellipseAxes: false,
  construction: false,
  domainSquare: false,
  centroid: true,
  contactRegion: true,
  intersections: false,
  boundingBox: false,
};

export type ParamGroup =
  | "points"
  | "path"
  | "curves"
  | "constraints"
  | "balance"
  | "exploration";

export type NumericParamMeta = {
  kind: "number";
  label: string;
  group: ParamGroup;
  min: number;
  max: number;
  step: number;
  /** Omitted means randomizable. Meta parameters opt out so exploration never rewrites them. */
  randomizable?: false;
};

export type EnumParamMeta<T extends string> = {
  kind: "enum";
  label: string;
  group: ParamGroup;
  options: readonly T[];
  /** Override for an option whose display text `humanize` can't derive (accents, extra words). */
  optionLabels?: Partial<Record<T, string>>;
  randomizable?: false;
};

export type ParamMeta<K extends keyof Settings> = Settings[K] extends number
  ? NumericParamMeta
  : Settings[K] extends string
    ? EnumParamMeta<Settings[K]>
    : never;

/** One source of truth for the sliders, randomize, and mutate. */
export const PARAM_RANGES: { readonly [K in keyof Settings]: ParamMeta<K> } = {
  pointCount: { kind: "number", label: "Points", group: "points", min: 3, max: 24, step: 1 },
  pointDistribution: {
    kind: "enum",
    label: "Distribution",
    group: "points",
    options: ["uniform", "center", "edge", "clustered"],
  },
  margin: { kind: "number", label: "Margin", group: "points", min: 0, max: 0.3, step: 0.01 },
  clusterCount: { kind: "number", label: "Clusters", group: "points", min: 1, max: 6, step: 1 },

  startMode: {
    kind: "enum",
    label: "Start point",
    group: "path",
    options: ["lowest", "highest", "leftmost", "rightmost", "random"],
  },
  closingEdgeWeight: {
    kind: "number",
    label: "Closing pull",
    group: "path",
    min: 0,
    max: 1,
    step: 0.01,
  },

  curveStyle: {
    kind: "enum",
    label: "Edge curve",
    group: "curves",
    options: ["ellipse", "bezier"],
    optionLabels: { ellipse: "Half ellipse", bezier: "Bézier" },
  },
  radiusMode: {
    kind: "enum",
    label: "Bulge distribution",
    group: "curves",
    options: ["fixed", "uniform", "gaussian", "heavyTail"],
  },
  radiusScale: { kind: "number", label: "Bulge", group: "curves", min: 0.02, max: 2.5, step: 0.01 },
  radiusMin: { kind: "number", label: "Bulge min", group: "curves", min: 0.02, max: 2.5, step: 0.01 },
  radiusMax: { kind: "number", label: "Bulge max", group: "curves", min: 0.02, max: 2.5, step: 0.01 },
  radiusMean: { kind: "number", label: "Bulge mean", group: "curves", min: 0.02, max: 2.5, step: 0.01 },
  radiusVariation: {
    kind: "number",
    label: "Bulge spread",
    group: "curves",
    min: 0,
    max: 1,
    step: 0.01,
  },
  radiusTailPower: { kind: "number", label: "Tail power", group: "curves", min: 1, max: 8, step: 0.1 },
  arcSideMode: {
    kind: "enum",
    label: "Bulge side",
    group: "curves",
    options: ["same", "alternate", "random", "switchProbability", "spatialBias"],
  },
  switchProbability: {
    kind: "number",
    label: "Switch chance",
    group: "curves",
    min: 0,
    max: 1,
    step: 0.01,
  },
  biasDirection: {
    kind: "enum",
    label: "Bias direction",
    group: "curves",
    options: ["up", "down", "left", "right", "outward", "inward"],
  },
  biasStrength: { kind: "number", label: "Bias strength", group: "curves", min: 0, max: 1, step: 0.05 },
  arcResolution: {
    kind: "number",
    label: "Resolution",
    group: "curves",
    min: 4,
    max: 64,
    step: 1,
    randomizable: false,
  },

  minimumClearance: {
    kind: "number",
    label: "Min clearance",
    group: "constraints",
    min: 0,
    max: 0.1,
    step: 0.001,
  },
  safeRadiusFactor: {
    kind: "number",
    label: "Safe radius factor",
    group: "constraints",
    min: 0.5,
    max: 1,
    step: 0.01,
    randomizable: false,
  },
  bulgeAggressiveness: {
    kind: "number",
    label: "Bulge aggressiveness",
    group: "constraints",
    min: 0,
    max: 1,
    step: 0.01,
  },
  sideSpaceBias: {
    kind: "number",
    label: "Side space bias",
    group: "constraints",
    min: -1,
    max: 1,
    step: 0.05,
  },
  curveGrowthPasses: {
    kind: "number",
    label: "Growth passes",
    group: "constraints",
    min: 1,
    max: 12,
    step: 1,
  },
  maxUntangleIterations: {
    kind: "number",
    label: "Max untangle iterations",
    group: "constraints",
    min: 50,
    max: 5000,
    step: 50,
    randomizable: false,
  },
  safeRadiusSearchIterations: {
    kind: "number",
    label: "Safe radius search",
    group: "constraints",
    min: 4,
    max: 20,
    step: 1,
    randomizable: false,
  },
  maxArcRepairAttempts: {
    kind: "number",
    label: "Max arc repairs",
    group: "constraints",
    min: 4,
    max: 64,
    step: 1,
    randomizable: false,
  },

  contactTolerance: {
    kind: "number",
    label: "Contact tolerance",
    group: "balance",
    min: 0.002,
    max: 0.2,
    step: 0.002,
    randomizable: false,
  },

  mutationAmount: {
    kind: "number",
    label: "Mutation amount",
    group: "exploration",
    min: 0.01,
    max: 1,
    step: 0.01,
    randomizable: false,
  },
  searchCandidates: {
    kind: "number",
    label: "Search candidates",
    group: "exploration",
    min: 20,
    max: 2000,
    step: 20,
    randomizable: false,
  },
};

/** Fixed iteration order; randomize and mutate depend on it for reproducibility. */
export const PARAM_KEYS = Object.keys(PARAM_RANGES) as (keyof Settings)[];

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
