/*
 * The complete microcopy deck from handoff §07, in one place.
 *
 * Every guest-facing string lives here so tone stays consistent and a wording change is one edit
 * rather than a search. This is the one part of the feature that needs a deploy to change — which
 * is correct, because it's design, not data. Roster and event details live in the database.
 *
 * Voice rules being honoured here: at most one café or work metaphor per screen; Andrew's name only
 * at the emotional peaks (welcome, last words, confirmation); errors in sentence case telling the
 * guest what to do next; no HR language; dietary copy kept plain.
 */

export const COPY = {
  event: {
    mark: "Andrew's Final Shift",
    tagline: "Clock in. One last time.",
  },

  clockIn: {
    eyebrow: "Timeclock / 01",
    headline: "Clock in for one last round.",
    instruction:
      "Enter your own 4-digit employee number, the one you use to clock in.",
    slotsLabel: "Employee no.",
    cta: "Clock in",
    help: "Forgot your employee number?",
    errors: {
      // Identical for a wrong number, an inactive guest, and a tripped honeypot. The server sends
      // this byte-for-byte in every failure case so nothing distinguishes "no such guest" from
      // "not your guest" — see the session route.
      unknown:
        "That number is not on today's roster. Check the employee number you use to clock in and try again.",
      incomplete: "Enter all four digits to clock in.",
      temporary: "The timeclock missed that punch. Try clocking in again.",
      rateLimited:
        "That's a lot of tries. Give it a few minutes, then clock in again.",
    },
  },

  welcome: {
    headline: (firstName: string) => `Hey, ${firstName}.`,
    body: "You're scheduled for one final shift with Andrew.",
    expectation:
      "RSVP, snap a shift photo, and leave one line for the farewell wall.",
    badgeLabel: "Employee",
    cta: "Start my shift",
    notYou: (firstName: string) => `Not ${firstName}?`,
  },

  receipt: {
    heading: "Will you clock in for the party?",
    yes: "Yes, put me on the schedule",
    yesSupport: "Count me in for the send-off.",
    no: "I can't make this shift",
    noSupport: "You can still leave something for Andrew.",
    // Shown once the guest declines. Warmth here is the point: declining must never read as an
    // error state.
    declineNote:
      "You may be off the party schedule, but you still have one final shift photo to take.",
    // The venue label and its link text. Only the words live here — the venue itself is a row in
    // event_config, so a wrong address is a Supabase edit rather than a deploy.
    venueLabel: "Where",
    venueMapCta: "Open in Maps",
    datePrompt: "Which dates can you work?",
    dateSupport: "Select every date that works.",
    dietaryLabel: "Anything the kitchen should know?",
    dietarySupport: "Optional. Allergies, restrictions, anything at all.",
    dietaryPlaceholder: "Nothing the kitchen needs to know",
    consentLabel:
      "I'm okay with my photo, caption, and memory appearing on the invite-only farewell wall.",
    consentSupport:
      "If you leave this unchecked, your photo and words will only be shown to Andrew.",
    cta: "Continue to shift photo",
    errors: {
      noAttendance: "Choose whether you can clock in for the party.",
      noDate: "Select at least one date that works for you.",
      longDietary: "Keep the kitchen note under 160 characters.",
    },
  },

  photo: {
    heading: "Take your shift photo",
    support:
      "Every final shift needs a crew photo. Take one now or upload one you like.",
    camera: "Open camera",
    upload: "Upload a photo",
    // Desktop browsers ignore the `capture` attribute, so the two routes collapse into one there.
    choose: "Choose a photo",
    retake: "Retake",
    approve: "Use this photo",
    uploading: "Uploading...",
    preparing: "Getting your photo ready...",
    placeholder: "Nothing in the frame yet.",
    tryAgain: "Try again",
    captionLabel: "Write on your Polaroid",
    captionPlaceholder: "Proof we survived the rush.",
    consentPublic: "This will appear on the invite-only farewell wall.",
    consentPrivate: "This will only be shown to Andrew.",
    cta: "Continue",
    errors: {
      permissionDenied:
        "Camera access is off. Upload a photo instead to continue.",
      noCaption: "Add a caption to finish your Polaroid.",
      tooLarge: "That photo is too large. Try another one.",
      decodeFailed:
        "That photo format didn't work. Try taking a new one, or pick a different photo.",
      uploadFailed:
        "That photo didn't finish uploading. Your caption is safe — try again.",
      longCaption: "Keep the caption under 60 characters.",
    },
  },

  lastWords: {
    heading: "One line for Andrew",
    support: "Anything you want to tell him.",
    placeholder: "Remember when...",
    label: "Your line",
    cta: "Review my timecard",
    skip: "Skip this line",
    errors: {
      longMemory: "Keep it under 180 characters so it fits on the wall.",
    },
  },

  review: {
    heading: "Review before clocking out",
    support: "Here's exactly what gets submitted.",
    edit: "Edit",
    sections: {
      rsvp: "RSVP",
      dates: "Available dates",
      dietary: "Kitchen note",
      photo: "Shift photo",
      caption: "Caption",
      memory: "Last words",
      visibility: "Wall visibility",
    },
    values: {
      attending: "Clocking in",
      notAttending: "Can't make this shift",
      none: "None",
      skipped: "Skipped",
      shared: "Shared with the invite-only wall",
      private: "Private to Andrew",
    },
    confirmation: "By clocking out, you confirm this RSVP. You can edit it any time.",
    confirmationLocked: "By clocking out, you confirm this RSVP.",
    cta: "Clock out & confirm",
    ctaEditing: "Save changes",
    submitting: "Clocking out...",
    errors: {
      failed: "That punch didn't go through. Nothing was lost — try again.",
      incomplete: "Something's still missing. We'll take you back to it.",
    },
  },

  complete: {
    stamp: "Shift complete",
    headline: "You're officially off the clock.",
    support: "Thanks for showing up for Andrew, one last time.",
    cta: "Open the farewell wall",
    edit: "Edit my RSVP",
    myNote: "My note",
    // Returning-guest variant.
    backHeadline: "You're already clocked out.",
    backSupport: "Your timecard is in. Come see what everyone else left.",
  },

  note: {
    heading: "One last receipt",
    forLabel: "Private note for",
    employeeLabel: "Employee",
    fromLabel: "From",
    messageLabel: "Message",
    from: "Andrew",
    dismiss: "Keep exploring the wall",
    privateBadge: "Private — only you can see this",
    fallback: (firstName: string) =>
      `${firstName}, thanks for being part of this chapter. It would not have been the same without you.`,
  },

  wall: {
    heading: "The Farewell Wall",
    subheading: "Notes from the crew.",
    myNote: "My note",
    myRsvp: "My RSVP",
    youAreHere: "You are here",
    // Shown when the guest is the first one through. This is the common case at this group size,
    // not an edge case.
    empty:
      "You're early to the shift. Your note is the first one on the wall.",
    emptyNoContribution:
      "Nothing on the wall yet. Check back once the crew starts clocking out.",
    unavailable: "Some notes are taking a coffee break. Try the wall again.",
    cardOpen: "Open card",
    cardClose: "Close",
  },

  frame: {
    back: "Back",
    progress: (step: number, total: number, label: string) =>
      `${label} ${step} of ${total}`,
    // Announced in the live region after each transition.
    announce: (step: number, total: number, label: string) =>
      `Step ${step} of ${total}, ${label}`,
  },

  // Andrew's screen, not a guest's. Plain and unceremonious on purpose — this one is a tool.
  admin: {
    heading: "Back of house",
    lockHeading: "Manager's key",
    lockSupport: "This screen shows everyone's answers. It needs the passphrase.",
    passphraseLabel: "Passphrase",
    unlock: "Unlock",
    errors: {
      bad: "That's not the passphrase.",
      rateLimited: "Too many tries. Give it a few minutes.",
      temporary: "Couldn't check that just now. Try again.",
    },
    dates: "Which day works",
    datesEmpty: "No dates are set on the event config yet.",
    responses: "Everyone",
    dietary: "Food notes",
    dietaryEmpty: "Nothing to work around so far.",
    photos: "Photos",
    photosEmpty: "No photos yet.",
    coverage: "Before the party",
    coverageClear: "Every active guest has clocked out and has a note written.",
    noNote: "No private note written — they'll get the fallback line.",
    noClockIn: "Hasn't clocked in yet.",
    started: "Started but hasn't clocked out.",
    consentYes: "On the wall",
    consentNo: "Private — not on the wall",
    votes: (count: number) => (count === 1 ? "1 person" : `${count} people`),
  },

  locked: {
    badge: "Edits are closed",
    body: "This RSVP is locked in. If something needs changing, reach out and Andrew will sort it.",
    // For a guest who arrives after the freeze without ever having clocked out. They can't fill
    // anything in, so they're told that plainly rather than shown a form that would refuse to save.
    heading: "The clipboard's put away.",
    support: "Andrew has closed the RSVP. It's not too late to be there, though.",
  },
} as const;
