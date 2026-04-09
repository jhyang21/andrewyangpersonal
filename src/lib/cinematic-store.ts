"use client";

import { create } from "zustand";
import type { EntryRect } from "@/types/cinematic";

type CinematicStore = {
  entryRect: EntryRect | null;
  setEntryRect: (rect: EntryRect) => void;
  clearEntryRect: () => void;
};

export const useCinematicStore = create<CinematicStore>((set) => ({
  entryRect: null,
  setEntryRect: (rect) => set({ entryRect: rect }),
  clearEntryRect: () => set({ entryRect: null }),
}));
