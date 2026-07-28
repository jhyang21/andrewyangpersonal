"use client";

import type { PreparedPhoto } from "@/lib/final-shift/image";
import type { PhotoRef } from "@/lib/final-shift/types";

export type UploadHandlers = {
  /** 0–1. Called often enough to animate; never called after the promise settles. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

export class UploadError extends Error {
  constructor(message = "Upload failed.") {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * ★ STUB — Phase 3.
 *
 * The real implementation (Phase 5) is three calls: POST /photo/upload-url to get a signed URL for
 * a path the *server* chooses, an XHR PUT of the blob straight to Supabase Storage with real
 * `upload.onprogress` events, then POST /photo/commit to record the path and delete the previous
 * object. The browser→storage PUT is deliberate: routing bytes through a Next route handler would
 * hit Vercel's 4.5 MB request-body cap and double the bytes over the guest's uplink on the slowest
 * step of the flow.
 *
 * This stand-in keeps that exact signature — a promise, progress events, an abort signal, and a
 * PhotoRef out — so Phase 5 replaces the body and touches no caller. The progress it reports is
 * simulated, and the returned `path` is not a real storage path. Nothing else here is fake: the
 * blob is the same blob, and every caller-side path (retry, abort, error copy) is the real one.
 */
export function uploadPhoto(
  prepared: PreparedPhoto,
  handlers: UploadHandlers = {},
): Promise<PhotoRef> {
  const { onProgress, signal } = handlers;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadError("Upload cancelled."));
      return;
    }

    let step = 0;
    const steps = 8;

    const timer = window.setInterval(() => {
      step += 1;
      onProgress?.(step / steps);

      if (step < steps) return;

      window.clearInterval(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve({
        // Phase 5 replaces this with the path the server minted. Shaped like the real thing so a
        // caller that starts depending on the shape doesn't have to change either.
        path: `photos/stub/${Math.random().toString(36).slice(2, 10)}.jpg`,
        width: prepared.width,
        height: prepared.height,
        /*
         * The object URL from the decode step, reused as the display URL. In Phase 5 this is a
         * 900-second signed GET URL from the private bucket instead — which is why callers must
         * treat PhotoRef.url as something that expires, and never cache it.
         */
        url: prepared.previewUrl,
      });
    }, 90);

    function onAbort() {
      window.clearInterval(timer);
      reject(new UploadError("Upload cancelled."));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
