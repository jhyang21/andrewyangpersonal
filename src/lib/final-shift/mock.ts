/*
 * Fake data for building the flow before the backend exists — and before Andrew hands over the real
 * roster. Every name, number, and note here is invented. Nothing in this file is real, and nothing
 * real is ever to be added to it: the actual roster carries coworkers' workplace clock-in codes and
 * personal notes, and lives in a gitignored file that seeds the database.
 *
 * The four guests match the verification matrix in the plan, so the states that are awkward to reach
 * by clicking (already submitted, submitted with the wall declined) are one code away.
 *
 * Deleted in Phase 5, when net.ts talks to the real routes.
 */

import type { EventConfig, SessionPayload, Submission } from "./types";

export const MOCK_EVENT: EventConfig = {
  eventName: "Andrew's Final Shift",
  subtitle: "Clock in. One last time.",
  contactLine: "Forgot your employee number? Text Andrew and he'll sort it.",
  dateOptions: [
    {
      id: "d1",
      startsAt: "2026-08-22T19:00:00-07:00",
      label: "Saturday, August 22",
      sublabel: "7–11 PM",
    },
    {
      id: "d2",
      startsAt: "2026-08-29T19:00:00-07:00",
      label: "Saturday, August 29",
      sublabel: "7–11 PM",
    },
    {
      id: "d3",
      startsAt: "2026-09-05T18:00:00-07:00",
      label: "Saturday, September 5",
      sublabel: "6–10 PM",
    },
  ],
  dietaryChips: ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Halal", "No nuts"],
  wallEnabled: true,
  editsLocked: false,
};

function emptySubmission(): Submission {
  return {
    status: "draft",
    attending: null,
    availableDates: [],
    dietaryTags: [],
    dietaryNote: "",
    photo: null,
    caption: "",
    memory: "",
    wallConsent: false,
    submittedAt: null,
  };
}

const MOCK_GUESTS: Record<string, SessionPayload> = {
  // Fresh guest, nothing filled in. The default path.
  "0001": {
    guest: { firstName: "Mina", code: "0001", crewRole: "Opening shift partner" },
    submission: emptySubmission(),
    event: MOCK_EVENT,
  },

  // Fresh guest used for walking the decline path.
  "0002": {
    guest: { firstName: "Dev", code: "0002", crewRole: "Closing shift partner" },
    submission: emptySubmission(),
    event: MOCK_EVENT,
  },

  // Already clocked out, wall consent given — lands straight on the complete stage.
  "0003": {
    guest: { firstName: "Sofía", code: "0003", crewRole: "Espresso bar lead" },
    submission: {
      ...emptySubmission(),
      status: "submitted",
      attending: true,
      availableDates: ["d1", "d3"],
      dietaryTags: ["Vegetarian"],
      dietaryNote: "No mushrooms, please.",
      caption: "Proof we survived the rush.",
      memory: "You made the 5 AM opens bearable. Nobody else could do that.",
      wallConsent: true,
      submittedAt: "2026-08-01T17:04:00-07:00",
    },
    event: MOCK_EVENT,
  },

  // Clocked out but declined the wall — must produce no card and no trace of an absence.
  "0004": {
    guest: { firstName: "박지훈", code: "0004", crewRole: "Weekend bar partner" },
    submission: {
      ...emptySubmission(),
      status: "submitted",
      attending: false,
      caption: "Last one behind the bar.",
      memory: "Go be great. Don't forget the grinder settings.",
      wallConsent: false,
      submittedAt: "2026-08-02T11:20:00-07:00",
    },
    event: MOCK_EVENT,
  },
};

/** Stands in for POST /api/final-shift/session. Returns null for anything not on the fake roster. */
export function mockClockIn(code: string): SessionPayload | null {
  return MOCK_GUESTS[code] ?? null;
}

export const MOCK_CODES = Object.keys(MOCK_GUESTS);
