"use client";

import { COPY } from "@/lib/final-shift/copy";
import type {
  DraftValues,
  PrivateNote,
  SessionPayload,
  Submission,
  WallCard,
} from "@/lib/final-shift/types";
import type { MissingField } from "@/lib/final-shift/validate";

/*
 * The client's half of the API. Every request the browser makes to /api/final-shift goes through
 * here, so the error shape is uniform and no stage has to know what a Response looks like.
 */

const BASE = "/api/final-shift";

export class ApiError extends Error {
  /** 0 when the request never reached the server — offline, DNS, a killed radio. */
  readonly status: number;
  readonly code: string | null;
  readonly retryAfterSeconds: number | null;
  /** Only from POST /submit. Tells the machine which stage to drop the guest back on. */
  readonly missing: MissingField[];

  constructor(
    status: number,
    code: string | null,
    message: string,
    options: { retryAfterSeconds?: number | null; missing?: MissingField[] } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.missing = options.missing ?? [];
  }
}

type Envelope = {
  ok?: boolean;
  code?: string;
  message?: string;
  missing?: MissingField[];
};

async function request<T>(
  path: string,
  init: RequestInit & { fallbackMessage?: string } = {},
): Promise<T> {
  const { fallbackMessage, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      credentials: "same-origin",
      cache: "no-store",
      ...rest,
      headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
    });
  } catch {
    // A thrown fetch is a network failure, never an HTTP status. Phones on the move produce these
    // constantly, so it gets the "try again" wording rather than anything alarming.
    throw new ApiError(0, "offline", fallbackMessage ?? COPY.clockIn.errors.temporary);
  }

  const body = (await response.json().catch(() => null)) as Envelope | null;

  if (!response.ok || body?.ok !== true) {
    const retryAfter = response.headers.get("Retry-After");
    throw new ApiError(
      response.status,
      body?.code ?? null,
      body?.message ?? fallbackMessage ?? COPY.clockIn.errors.temporary,
      {
        retryAfterSeconds: retryAfter ? Number.parseInt(retryAfter, 10) : null,
        missing: body?.missing,
      },
    );
  }

  return body as T;
}

/**
 * Clock in.
 *
 * `company` is a honeypot and always empty from a real guest — it exists so a form-filling bot
 * identifies itself. The server answers a tripped honeypot with exactly the same body and the same
 * response time as an unknown code, so nothing here needs to handle it specially.
 */
export async function clockIn(code: string, company = ""): Promise<SessionPayload> {
  const body = await request<{ ok: true } & SessionPayload>("/session", {
    method: "POST",
    body: JSON.stringify({ code, company }),
    fallbackMessage: COPY.clockIn.errors.temporary,
  });
  return { guest: body.guest, submission: body.submission, event: body.event };
}

/** Re-reads the session behind the cookie. Returns null when there isn't one. */
export async function resumeSession(): Promise<SessionPayload | null> {
  try {
    const body = await request<{ ok: true } & SessionPayload>("/session");
    return { guest: body.guest, submission: body.submission, event: body.event };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function signOut(): Promise<void> {
  await request("/session", { method: "DELETE" });
}

/**
 * Autosave. Deliberately swallows its own failures.
 *
 * A background save is not something the guest asked for, so a failed one must not interrupt them —
 * the values are still in memory, the localStorage mirror still has them, and the next keystroke
 * schedules another attempt. The submit carries the final values anyway, which is what makes losing
 * an intermediate save harmless.
 */
export async function saveDraft(patch: Partial<DraftValues>): Promise<void> {
  try {
    await request("/draft", { method: "PATCH", body: JSON.stringify(patch) });
  } catch {
    // Intentionally silent. See above.
  }
}

export async function submitShift(
  values: DraftValues,
): Promise<{ submission: Submission; note: PrivateNote }> {
  const body = await request<{ ok: true; submission: Submission; note: PrivateNote }>(
    "/submit",
    {
      method: "POST",
      body: JSON.stringify(values),
      fallbackMessage: COPY.review.errors.failed,
    },
  );
  return { submission: body.submission, note: body.note };
}

export async function fetchNote(): Promise<PrivateNote> {
  const body = await request<{ ok: true; note: PrivateNote }>("/note");
  return body.note;
}

export async function fetchWall(): Promise<{ enabled: boolean; cards: WallCard[] }> {
  const body = await request<{ ok: true; enabled: boolean; cards: WallCard[] }>("/wall", {
    fallbackMessage: COPY.wall.unavailable,
  });
  return { enabled: body.enabled, cards: body.cards };
}

/** Used by the photo upload path, which needs the raw signed URL rather than a PhotoRef. */
export async function requestUploadUrl(
  bytes: number,
): Promise<{ path: string; signedUrl: string }> {
  const body = await request<{ ok: true; path: string; signedUrl: string }>(
    "/photo/upload-url",
    {
      method: "POST",
      body: JSON.stringify({ bytes }),
      fallbackMessage: COPY.photo.errors.uploadFailed,
    },
  );
  return { path: body.path, signedUrl: body.signedUrl };
}

export async function commitPhoto(input: {
  path: string;
  width: number;
  height: number;
}): Promise<{ path: string; width: number; height: number; url: string }> {
  const body = await request<{
    ok: true;
    photo: { path: string; width: number; height: number; url: string };
  }>("/photo/commit", {
    method: "POST",
    body: JSON.stringify(input),
    fallbackMessage: COPY.photo.errors.uploadFailed,
  });
  return body.photo;
}

/**
 * Andrew's passphrase, exchanged for the admin cookie.
 *
 * Nothing comes back but `ok`. The dashboard is rendered on the server behind the same cookie, so
 * there is no payload to hand to a browser that has not proved anything yet.
 */
export async function adminLogin(passphrase: string): Promise<void> {
  await request<{ ok: true }>("/admin", {
    method: "POST",
    body: JSON.stringify({ passphrase }),
    fallbackMessage: COPY.admin.errors.temporary,
  });
}
