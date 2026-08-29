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
  /** What the dial does to the shape, in the words a first-time visitor would use. */
  description: string;
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
  description: string;
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

/** One source of truth for the sliders, randomize, mutate, and the hover descriptions. */
export const PARAM_RANGES: { readonly [K in keyof Settings]: ParamMeta<K> } = {
  pointCount: {
    kind: "number",
    label: "Points",
    description:
      "How many scattered points the outline has to visit. More points cut the shape into more, shorter edges.",
    group: "points",
    min: 3,
    max: 24,
    step: 1,
  },
  pointDistribution: {
    kind: "enum",
    label: "Distribution",
    description:
      "Where the points fall in the square. Center piles them in the middle, Edge pushes them out to the rim, Clustered gathers them into knots.",
    group: "points",
    options: ["uniform", "center", "edge", "clustered"],
  },
  margin: {
    kind: "number",
    label: "Margin",
    description:
      "Blank space kept clear around the rim of the square. Larger values pull the points inward and make a smaller shape.",
    group: "points",
    min: 0,
    max: 0.3,
    step: 0.01,
  },
  clusterCount: {
    kind: "number",
    label: "Clusters",
    description:
      "How many knots the points gather into. A few clusters give dense lumps joined by long runs.",
    group: "points",
    min: 1,
    max: 6,
    step: 1,
  },

  startMode: {
    kind: "enum",
    label: "Start point",
    description:
      "Which point the tour sets off from. The walk is greedy, so a different start joins the points in a different order.",
    group: "path",
    options: ["lowest", "highest", "leftmost", "rightmost", "random"],
  },
  closingEdgeWeight: {
    kind: "number",
    label: "Closing pull",
    description:
      "Pulls the end of the tour back toward its start. Higher values close the loop tidily instead of leaving one long edge to reach home.",
    group: "path",
    min: 0,
    max: 1,
    step: 0.01,
  },

  curveStyle: {
    kind: "enum",
    label: "Edge curve",
    description:
      "The curve each edge bulges into. A half ellipse swells evenly along the edge; a Bézier reaches the same peak but leaves the two ends flatter.",
    group: "curves",
    options: ["ellipse", "bezier"],
    optionLabels: { ellipse: "Half ellipse", bezier: "Bézier" },
  },
  radiusMode: {
    kind: "enum",
    label: "Bulge distribution",
    description:
      "How each edge draws its bulge. Fixed gives every edge the same one, Uniform spreads them evenly between the bounds, Gaussian clusters them near a mean, and Heavy tail keeps most of them small and lets a few run large.",
    group: "curves",
    options: ["fixed", "uniform", "gaussian", "heavyTail"],
  },
  radiusScale: {
    kind: "number",
    label: "Bulge",
    description:
      "The single bulge every edge takes in Fixed mode. It is measured against the edge, so 1 swells out as far as the edge is long.",
    group: "curves",
    min: 0.02,
    max: 2.5,
    step: 0.01,
  },
  radiusMin: {
    kind: "number",
    label: "Bulge min",
    description: "The smallest bulge an edge can draw. Raise it to stop any edge going near flat.",
    group: "curves",
    min: 0.02,
    max: 2.5,
    step: 0.01,
  },
  radiusMax: {
    kind: "number",
    label: "Bulge max",
    description: "The largest bulge an edge can draw. Raise it for wilder, more balloon-like swells.",
    group: "curves",
    min: 0.02,
    max: 2.5,
    step: 0.01,
  },
  radiusMean: {
    kind: "number",
    label: "Bulge mean",
    description: "The bulge most edges land near in Gaussian mode.",
    group: "curves",
    min: 0.02,
    max: 2.5,
    step: 0.01,
  },
  radiusVariation: {
    kind: "number",
    label: "Bulge spread",
    description:
      "How far edges wander from the mean in Gaussian mode. At 0 every edge swells by the same amount.",
    group: "curves",
    min: 0,
    max: 1,
    step: 0.01,
  },
  radiusTailPower: {
    kind: "number",
    label: "Tail power",
    description:
      "How rare a big bulge is in Heavy tail mode. Higher values hold most edges near the minimum and save the swell for one or two.",
    group: "curves",
    min: 1,
    max: 8,
    step: 0.1,
  },
  arcSideMode: {
    kind: "enum",
    label: "Bulge side",
    description:
      "How each edge picks which way to bulge: all one way, strictly alternating, at random, on a switch chance, or leaning toward a direction.",
    group: "curves",
    options: ["same", "alternate", "random", "switchProbability", "spatialBias"],
  },
  switchProbability: {
    kind: "number",
    label: "Switch chance",
    description:
      "The chance each edge flips to the other side of the line. Near 0 the outline runs in long smooth sweeps; near 1 it zigzags in and out.",
    group: "curves",
    min: 0,
    max: 1,
    step: 0.01,
  },
  biasDirection: {
    kind: "enum",
    label: "Bias direction",
    description:
      "The way the bulges lean. Outward swells away from the middle of the square and inward swells toward it.",
    group: "curves",
    options: ["up", "down", "left", "right", "outward", "inward"],
  },
  biasStrength: {
    kind: "number",
    label: "Bias strength",
    description:
      "How strongly that lean wins. At 0 each side is a coin toss; at 1 almost every edge follows the direction.",
    group: "curves",
    min: 0,
    max: 1,
    step: 0.05,
  },
  arcResolution: {
    kind: "number",
    label: "Resolution",
    description:
      "How many straight steps stand in for each curve. Higher looks smoother and takes longer to draw.",
    group: "curves",
    min: 4,
    max: 64,
    step: 1,
    randomizable: false,
  },

  minimumClearance: {
    kind: "number",
    label: "Min clearance",
    description:
      "The gap the outline must keep from itself. Larger values push the curves apart, so the shape loses its tightest pinches.",
    group: "constraints",
    min: 0,
    max: 0.1,
    step: 0.001,
  },
  safeRadiusFactor: {
    kind: "number",
    label: "Safe radius factor",
    description:
      "How near its limit a curve may grow. Lower values keep a wider margin of safety and give tamer curves.",
    group: "constraints",
    min: 0.5,
    max: 1,
    step: 0.01,
    randomizable: false,
  },
  bulgeAggressiveness: {
    kind: "number",
    label: "Bulge aggressiveness",
    description:
      "How hard the curves push into the room they have. Higher values fill the space, even past the bulge the edge first drew.",
    group: "constraints",
    min: 0,
    max: 1,
    step: 0.01,
  },
  sideSpaceBias: {
    kind: "number",
    label: "Side space bias",
    description:
      "Which side a curve takes when one has more room. Negative sends it to the roomy side; positive makes it squeeze into the tight one and form necks.",
    group: "constraints",
    min: -1,
    max: 1,
    step: 0.05,
  },
  curveGrowthPasses: {
    kind: "number",
    label: "Growth passes",
    description:
      "How many rounds the curves grow in. More rounds let neighbours make room for each other, so the bulges end up larger and more even. It costs time.",
    group: "constraints",
    min: 1,
    max: 12,
    step: 1,
  },
  maxUntangleIterations: {
    kind: "number",
    label: "Max untangle iterations",
    description:
      "How long to keep pulling crossings out of the tour before giving up on it. Raise it only for very crowded point sets; it buys reliability, not looks.",
    group: "constraints",
    min: 50,
    max: 5000,
    step: 50,
    randomizable: false,
  },
  safeRadiusSearchIterations: {
    kind: "number",
    label: "Safe radius search",
    description:
      "How finely to hunt for the biggest bulge that still fits. More steps find a slightly fuller curve and take slightly longer.",
    group: "constraints",
    min: 4,
    max: 20,
    step: 1,
    randomizable: false,
  },
  maxArcRepairAttempts: {
    kind: "number",
    label: "Max arc repairs",
    description:
      "How many fixes the solver may make when two curves collide. More attempts rescue a difficult shape instead of shrinking every curve at once.",
    group: "constraints",
    min: 4,
    max: 64,
    step: 1,
    randomizable: false,
  },

  contactTolerance: {
    kind: "number",
    label: "Contact tolerance",
    description:
      "How near the lowest point still counts as touching the ground. Wider values find more of a foot, so the shape reads as better supported.",
    group: "balance",
    min: 0.002,
    max: 0.2,
    step: 0.002,
    randomizable: false,
  },

  mutationAmount: {
    kind: "number",
    label: "Mutation amount",
    description:
      "How far Mutate nudges the settings. Small values tweak what you have; large ones throw the shape somewhere new.",
    group: "exploration",
    min: 0.01,
    max: 1,
    step: 0.01,
    randomizable: false,
  },
  searchCandidates: {
    kind: "number",
    label: "Search candidates",
    description:
      "How many seeds Find precarious tries before it picks a winner. More candidates find a more unstable shape and take longer.",
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
