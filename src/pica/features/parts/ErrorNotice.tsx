"use client";

import { useEffect, useRef, type RefObject } from "react";
import { Banner, Button, EmptyState } from "@/pica/components/kit";
import { Pica } from "@/pica/components/mascot";
import { track } from "@/pica/lib/analytics";
import type { ApiError } from "@/pica/lib/types";
import { errorView } from "@/pica/features/shared/errors";

/** Where on the journey an error showed. Sent with `error_shown`. The same values as the old part. */
export type ErrorPlace =
  | "home"
  | "chat"
  | "browse"
  | "decide"
  | "checkout"
  | "workspace"
  | "saved"
  | "done"
  | "storage";

export const RETRY_LABEL = "Try again";

/**
 * Calls `send` unless `sent` already holds `key`, then keeps `key`. One
 * error on screen sends once, though strict mode runs the effect twice on
 * the same refs. A new failure is a new notice with its own ref, or a new
 * code, so it sends again.
 */
export function trackOnce(sent: RefObject<string | null>, key: string, send: () => void): void {
  if (sent.current === key) return;
  sent.current = key;
  send();
}

function useTrackError(code: string, where: ErrorPlace, sessionId: string | null) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    trackOnce(sent, `${code}:${where}:${sessionId ?? ""}`, () => track("error_shown", { code, where }, sessionId));
  }, [code, where, sessionId]);
}

export interface ErrorNoticeViewProps {
  error: ApiError;
  onRetry?: () => void;
  className?: string;
}

export interface ErrorNoticeProps extends ErrorNoticeViewProps {
  where: ErrorPlace;
  sessionId?: string | null;
}

/**
 * The banner alone, with no analytics: for the parts page, or a screen that
 * already counted the error. Screens use `ErrorNotice`.
 */
export function ErrorNoticeView({ error, onRetry, className }: ErrorNoticeViewProps) {
  const view = errorView(error, "request");
  return (
    <Banner
      tone={view.tone}
      art={<Pica pose="unsure" size={24} label={null} />}
      action={onRetry && view.retry ? { label: RETRY_LABEL, onClick: onRetry } : undefined}
      className={className}
    >
      {view.message}
    </Banner>
  );
}

/**
 * A failed request, shown where it happened: the server's own words, word for
 * word, and "Try again" when trying again may work. Critical errors are
 * alerts and cautions are status lines; the role sits on the banner, never
 * on its button. Sends `error_shown` once per code and place.
 */
export function ErrorNotice({ error, where, sessionId = null, onRetry, className }: ErrorNoticeProps) {
  useTrackError(error.code, where, sessionId);
  return <ErrorNoticeView error={error} onRetry={onRetry} className={className} />;
}

export interface ErrorStateViewProps {
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  /** Default `h2`. Use `h3` under a section heading. */
  headingLevel?: "h2" | "h3";
}

export interface ErrorStateProps extends ErrorStateViewProps {
  code: string;
  where: ErrorPlace;
  sessionId?: string | null;
}

/** The whole-panel state with no analytics. Screens use `ErrorState`. */
export function ErrorStateView({ title, description, action, headingLevel }: ErrorStateViewProps) {
  return (
    // The alert wraps the whole state; its button carries no role.
    <div role="alert">
      <EmptyState
        art={<Pica pose="unsure" size={120} label={null} />}
        title={title}
        description={description}
        headingLevel={headingLevel}
        action={
          action ? (
            <Button href={action.href} onClick={action.onClick} on="canvas">
              {action.label}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

/**
 * A whole panel that cannot show, such as a decision not saved in this
 * browser: Pica unsure at 120, a title, one line and one way on. Sends
 * `error_shown` once per code and place.
 */
export function ErrorState({ code, where, sessionId = null, ...view }: ErrorStateProps) {
  useTrackError(code, where, sessionId);
  return <ErrorStateView {...view} />;
}
