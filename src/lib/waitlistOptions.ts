export const identityOptions = [
  "Real estate professional",
  "Legal professional",
  "Financial professional",
  "Sales or business development",
  "Founder or executive",
  "Investor",
  "Other",
] as const;

export const emotionalHookOptions = ["Rarely", "Sometimes", "Often", "Too often"] as const;

export const featureSignalOptions = [
  "One-tap voice capture",
  "Smart follow-up reminders",
  "Context popping up on calendar and calls",
  "Search across people",
  "AI call prep before meetings",
] as const;

export const commitmentOptions = [
  "Yes, I want early access",
  "Yes, and I'll give feedback",
  "Just keep me updated",
] as const;

export const IDENTITY_OPTIONS = new Set<string>(identityOptions);
export const EMOTIONAL_HOOK_OPTIONS = new Set<string>(emotionalHookOptions);
export const FEATURE_SIGNAL_OPTIONS = new Set<string>(featureSignalOptions);
export const COMMITMENT_OPTIONS = new Set<string>(commitmentOptions);
