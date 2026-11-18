"use client";

import { BASE } from "@/pica/lib/base";
import { Banner } from "@/pica/components/kit";
import type { StorageHealth } from "@/pica/lib/session";
import { useStorageNotice } from "@/pica/features/shell/useStorageNotice";

export type StorageProblem = Exclude<StorageHealth, "ok">;

export const STORAGE_NOTICE = {
  title: "Changes aren't being saved",
  blocked:
    "Your browser is blocking storage for this site, so your decisions stay in this tab only. Allow site data for this site to keep them.",
  full: "Your browser has run out of room for this site, so new changes stay in this tab only. Remove old decisions on Saved to free space.",
} as const;

export interface StorageNoticeViewProps {
  problem: StorageProblem;
  className?: string;
}

/** The banner for one cause, with no store and no analytics. Screens use `StorageNotice`. */
export function StorageNoticeView({ problem, className }: StorageNoticeViewProps) {
  return (
    <Banner
      tone="caution"
      title={STORAGE_NOTICE.title}
      action={problem === "full" ? { label: "Go to Saved", href: `${BASE}/saved` } : undefined}
      className={className}
    >
      {STORAGE_NOTICE[problem]}
    </Banner>
  );
}

/**
 * A caution under the header when the browser blocks storage or runs out of
 * room. Decisions still work in this tab. Renders nothing while saving works.
 * `useStorageNotice` sends `error_shown` once per page load per cause.
 */
export function StorageNotice({ className }: { className?: string }) {
  const problem = useStorageNotice();
  if (!problem) return null;
  return <StorageNoticeView problem={problem} className={className} />;
}
