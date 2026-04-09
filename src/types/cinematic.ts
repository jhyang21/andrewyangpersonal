export type ThesisState = "stable" | "evolving" | "contradicted" | "emerging";

export type ThesisVersion = {
  version: number;
  date: string;
  body: string;
  changeReason: string;
};

export type ContradictionMoment = {
  date: string;
  description: string;
  resolvedVersion?: number;
};

export type CinematicThesis = {
  slug: string;
  title: string;
  category: string;
  state: ThesisState;
  versions: ThesisVersion[];
  contradictions: ContradictionMoment[];
  relatedTheses: string[];
  essaySlug?: string;
};

export type EntryRect = {
  slug: string;
  rect: { x: number; y: number; width: number; height: number };
  viewportWidth: number;
  viewportHeight: number;
};
