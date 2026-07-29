"use client";

import type { PreparedPhoto } from "@/lib/final-shift/image";
import { ApiError, commitPhoto, requestUploadUrl } from "@/lib/final-shift/net";
import type { PhotoRef } from "@/lib/final-shift/types";

export type UploadHandlers = {
  /** 0–1. Called often enough to animate; never called after the promise settles. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

export class UploadError extends Error {
  /** True for a network failure or a timeout — the cases where trying again is not pointless. */
  readonly retriable: boolean;

  constructor(message = "Upload failed.", retriable = false) {
    super(message);
    this.name = "UploadError";
    this.retriable = retriable;
  }
}

/** 45 seconds. Long enough for 300 KB on bad LTE, short enough to be a failure rather than a hang. */
const TIMEOUT_MS = 45_000;

/*
 * Progress is split so the bar keeps moving through all three steps rather than sitting at zero
 * while the URL is minted and at ninety while the row is written.
 */
const SIGNED = 0.05;
const UPLOADED = 0.9;

/**
 * Sends the blob straight to storage, with real progress.
 *
 * XMLHttpRequest rather than fetch, for one reason: fetch has no upload progress event. A 300 KB PUT
 * on a weak connection is fifteen seconds, and fifteen seconds of an unmoving screen is where a
 * guest closes the tab.
 */
function put(
  url: string,
  blob: Blob,
  handlers: UploadHandlers,
): Promise<void> {
  const { onProgress, signal } = handlers;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadError("Upload cancelled."));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.timeout = TIMEOUT_MS;
    xhr.setRequestHeader("Content-Type", blob.type || "image/jpeg");

    const done = () => signal?.removeEventListener("abort", onAbort);

    function onAbort() {
      xhr.abort();
      reject(new UploadError("Upload cancelled."));
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const fraction = event.loaded / event.total;
      onProgress?.(SIGNED + fraction * (UPLOADED - SIGNED));
    };

    xhr.onload = () => {
      done();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      // A 4xx from the bucket is the size or MIME limit doing its job, or an expired token. Neither
      // gets better on a second attempt with the same bytes.
      reject(new UploadError(`Storage refused the upload (${xhr.status}).`, xhr.status >= 500));
    };

    xhr.onerror = () => {
      done();
      reject(new UploadError("The upload could not reach storage.", true));
    };

    xhr.ontimeout = () => {
      done();
      reject(new UploadError("The upload timed out.", true));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    xhr.send(blob);
  });
}

async function attempt(
  prepared: PreparedPhoto,
  handlers: UploadHandlers,
): Promise<PhotoRef> {
  const { onProgress } = handlers;

  const { path, signedUrl } = await requestUploadUrl(prepared.blob.size);
  onProgress?.(SIGNED);

  await put(signedUrl, prepared.blob, handlers);
  onProgress?.(UPLOADED);

  const committed = await commitPhoto({
    path,
    width: prepared.width,
    height: prepared.height,
  });
  onProgress?.(1);

  return {
    path: committed.path,
    width: committed.width,
    height: committed.height,
    /*
     * The local object URL, not the signed one the server just returned.
     *
     * They are the same image, and this one is already decoded in memory — using it means the
     * develop animation plays on bytes the phone already has instead of waiting on a round trip to
     * the bucket for a photo the guest is looking at. The signed URL would expire in fifteen minutes
     * anyway; a reload mints a fresh one server-side, which is where it belongs.
     *
     * Ownership passes to the machine, which revokes it when the photo is replaced.
     */
    url: prepared.previewUrl,
  };
}

/**
 * Upload, with one silent retry.
 *
 * The retry starts from a fresh signed URL rather than re-sending to the old one: a PUT that failed
 * halfway may have left a partial object at that path, and asking for a new path is a line of code
 * against reasoning about what storage did with the bytes it half-received.
 *
 * Only network failures and timeouts are retried. A 413, a 403, or a rate limit means trying again
 * produces the same answer more slowly, and the guest is owed the error now.
 */
export async function uploadPhoto(
  prepared: PreparedPhoto,
  handlers: UploadHandlers = {},
): Promise<PhotoRef> {
  try {
    return await attempt(prepared, handlers);
  } catch (error) {
    const retriable =
      (error instanceof UploadError && error.retriable) ||
      (error instanceof ApiError && error.status === 0);

    if (!retriable || handlers.signal?.aborted) throw error;

    handlers.onProgress?.(0);
    return attempt(prepared, handlers);
  }
}
