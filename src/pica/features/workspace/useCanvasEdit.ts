"use client";

import { track } from "@/pica/lib/analytics";
import { dispatch, getSession, type CanvasEdit } from "@/pica/lib/session";
import { now } from "@/pica/features/shared/format";
import { editAnalytics } from "./canvas-model";

/**
 * Applies a buyer's canvas edit and counts it. The store drops edits while
 * Pica replies (the canvas lock), so `requirement_edited` fires only for an
 * edit that landed. Returns whether it landed.
 */
export function useCanvasEdit(sessionId: string) {
  return function apply(edit: CanvasEdit): boolean {
    // Read the kind before the edit, so a removed item still has one.
    const before = getSession(sessionId)?.canvas;
    const props = before ? editAnalytics(edit, before) : null;
    const landed = dispatch(sessionId, { type: "canvas_edited", edit, at: now() });
    if (landed && props) track("requirement_edited", props, sessionId);
    return landed;
  };
}
