import type { Settings } from "./types";

export type PresetId =
  | "blob"
  | "wobble"
  | "pinched"
  | "precarious"
  | "topHeavy"
  | "knot"
  | "extreme";

export type Preset = { label: string; settings: Partial<Settings> };

/**
 * Parameter-only merges: a preset never touches the seed or the locks. They are
 * partial, so a budget one preset raises stays raised when the next one is
 * clicked — pick a preset twice in a row to see only its own character.
 */
export const PRESETS: Record<PresetId, Preset> = {
  blob: {
    label: "Blob",
    settings: {
      pointCount: 7,
      pointDistribution: "uniform",
      margin: 0.1,
      startMode: "lowest",
      closingEdgeWeight: 0,
      curveStyle: "ellipse",
      radiusMode: "uniform",
      radiusMin: 0.28,
      radiusMax: 0.5,
      arcSideMode: "spatialBias",
      biasDirection: "outward",
      biasStrength: 1,
      minimumClearance: 0.03,
      safeRadiusFactor: 0.85,
      bulgeAggressiveness: 0.25,
      sideSpaceBias: -0.6,
      curveGrowthPasses: 4,
      contactTolerance: 0.04,
    },
  },
  wobble: {
    label: "Wobble",
    settings: {
      pointCount: 11,
      pointDistribution: "uniform",
      margin: 0.08,
      radiusMode: "uniform",
      radiusMin: 0.12,
      radiusMax: 0.6,
      arcSideMode: "alternate",
      minimumClearance: 0.015,
      safeRadiusFactor: 0.92,
      bulgeAggressiveness: 0.5,
      sideSpaceBias: 0,
      curveGrowthPasses: 5,
    },
  },
  pinched: {
    label: "Pinched",
    settings: {
      pointCount: 12,
      pointDistribution: "clustered",
      clusterCount: 2,
      margin: 0.06,
      radiusMode: "uniform",
      radiusMin: 0.35,
      radiusMax: 1.4,
      arcSideMode: "random",
      minimumClearance: 0.005,
      safeRadiusFactor: 0.97,
      bulgeAggressiveness: 0.95,
      sideSpaceBias: 0.9,
      curveGrowthPasses: 8,
      safeRadiusSearchIterations: 14,
      maxArcRepairAttempts: 40,
      contactTolerance: 0.02,
    },
  },
  precarious: {
    label: "Precarious",
    settings: {
      pointCount: 9,
      pointDistribution: "uniform",
      margin: 0.06,
      startMode: "lowest",
      radiusMode: "heavyTail",
      radiusMin: 0.12,
      radiusMax: 1.8,
      radiusTailPower: 3,
      arcSideMode: "switchProbability",
      switchProbability: 0.08,
      minimumClearance: 0.01,
      safeRadiusFactor: 0.94,
      bulgeAggressiveness: 0.85,
      sideSpaceBias: 0.35,
      curveGrowthPasses: 6,
      contactTolerance: 0.015,
    },
  },
  topHeavy: {
    label: "Top Heavy",
    settings: {
      pointCount: 9,
      pointDistribution: "center",
      margin: 0.08,
      radiusMode: "uniform",
      radiusMin: 0.22,
      radiusMax: 1,
      arcSideMode: "spatialBias",
      biasDirection: "up",
      biasStrength: 0.95,
      minimumClearance: 0.012,
      safeRadiusFactor: 0.9,
      bulgeAggressiveness: 0.7,
      sideSpaceBias: -0.2,
      curveGrowthPasses: 5,
      contactTolerance: 0.02,
    },
  },
  knot: {
    label: "Knot",
    settings: {
      pointCount: 16,
      pointDistribution: "center",
      margin: 0.05,
      closingEdgeWeight: 0.35,
      curveStyle: "bezier",
      radiusMode: "uniform",
      radiusMin: 0.25,
      radiusMax: 1.1,
      arcSideMode: "random",
      minimumClearance: 0.006,
      safeRadiusFactor: 0.96,
      bulgeAggressiveness: 0.9,
      sideSpaceBias: 0.6,
      curveGrowthPasses: 9,
      safeRadiusSearchIterations: 14,
      maxArcRepairAttempts: 40,
    },
  },
  extreme: {
    label: "Extreme",
    settings: {
      pointCount: 15,
      pointDistribution: "clustered",
      clusterCount: 2,
      margin: 0.04,
      radiusMode: "heavyTail",
      radiusMin: 0.05,
      radiusMax: 2.5,
      radiusTailPower: 2,
      arcSideMode: "random",
      minimumClearance: 0.003,
      safeRadiusFactor: 0.98,
      bulgeAggressiveness: 1,
      sideSpaceBias: 0.5,
      curveGrowthPasses: 10,
      safeRadiusSearchIterations: 16,
      maxArcRepairAttempts: 48,
      contactTolerance: 0.01,
    },
  },
};

export const PRESET_IDS: PresetId[] = [
  "blob",
  "wobble",
  "pinched",
  "precarious",
  "topHeavy",
  "knot",
  "extreme",
];
