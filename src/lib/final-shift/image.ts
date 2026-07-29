"use client";

/*
 * Client-side photo preparation: decode with the right orientation, downscale, re-encode as JPEG.
 *
 * Doing this in the browser is what lets the server stay out of the image business entirely — no
 * `sharp`, no Supabase image transforms (Pro-only), and a ~250 KB upload instead of a 12 MB one over
 * a phone's uplink. Everything here runs in the browser; there is no server equivalent.
 */

/** Long edge of the single rendition we keep. At under ten guests a thumbnail tier earns nothing. */
const MAX_EDGE = 1400;
const QUALITY = 0.82;
const FALLBACK_QUALITY = 0.7;

/** The bucket rejects anything larger; catch it here so the guest hears about it before the upload. */
export const MAX_OUTPUT_BYTES = 3 * 1024 * 1024;

/**
 * Anything bigger than this we refuse to even decode. A modern phone photo is 2–8 MB; 40 MB is a RAW
 * file or a video someone renamed, and attempting it risks an out-of-memory tab crash that looks to
 * the guest like the site dying.
 */
const MAX_INPUT_BYTES = 40 * 1024 * 1024;

export type PhotoErrorKind = "tooLarge" | "decodeFailed" | "encodeFailed";

export class PhotoError extends Error {
  readonly kind: PhotoErrorKind;
  constructor(kind: PhotoErrorKind, message: string) {
    super(message);
    this.name = "PhotoError";
    this.kind = kind;
  }
}

export type PreparedPhoto = {
  blob: Blob;
  /** Object URL for preview. The caller owns it and must revoke it. */
  previewUrl: string;
  width: number;
  height: number;
};

/**
 * Reads the image's true display dimensions — orientation already applied.
 *
 * Modern browsers default `<img>` to `image-orientation: from-image`, so naturalWidth/naturalHeight
 * are the rotated dimensions. That matters: a portrait photo from an iPhone is stored landscape with
 * an EXIF rotation flag, and sizing off the stored dimensions is exactly how the sideways-selfie bug
 * happens.
 */
function measure(file: File): Promise<{ url: string; img: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve({ url, img });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      /*
       * The realistic cause is HEIC. iOS "High Efficiency" hands HEIC straight out of the picker;
       * every iOS browser is WebKit underneath so they all decode it, but Chrome on Android cannot —
       * so an Android guest forwarded a friend's photo lands here. It needs a sentence, not a
       * spinner.
       */
      reject(new PhotoError("decodeFailed", "The browser could not decode this image."));
    };
    img.src = url;
  });
}

function targetSize(width: number, height: number) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Draws the source down to the target size, halving at each step.
 *
 * A single large downscale in one drawImage call aliases badly — a 4032px photo squeezed straight to
 * 1400 samples roughly one pixel in three and turns fine detail (hair, apron stitching, the text on
 * a cup) into noise. Halving repeatedly averages the pixels in between.
 */
function drawDownscaled(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  target: { width: number; height: number },
): HTMLCanvasElement {
  let currentWidth = sourceWidth;
  let currentHeight = sourceHeight;
  let current: CanvasImageSource = source;

  while (currentWidth > target.width * 2 && currentHeight > target.height * 2) {
    const nextWidth = Math.max(target.width, Math.round(currentWidth / 2));
    const nextHeight = Math.max(target.height, Math.round(currentHeight / 2));
    const step = document.createElement("canvas");
    step.width = nextWidth;
    step.height = nextHeight;
    const stepContext = step.getContext("2d");
    if (!stepContext) throw new PhotoError("encodeFailed", "No 2D context available.");
    stepContext.imageSmoothingQuality = "high";
    stepContext.drawImage(current, 0, 0, nextWidth, nextHeight);
    current = step;
    currentWidth = nextWidth;
    currentHeight = nextHeight;
  }

  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError("encodeFailed", "No 2D context available.");
  context.imageSmoothingQuality = "high";
  context.drawImage(current, 0, 0, target.width, target.height);
  return canvas;
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new PhotoError("encodeFailed", "Could not encode the image.")),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Turns whatever came out of the camera or picker into an upload-ready JPEG.
 *
 * Two things fall out of re-encoding through a canvas that are worth knowing about deliberately
 * rather than discovering later:
 *
 * All EXIF is dropped, including GPS. A photo taken at home carries the guest's home coordinates,
 * and re-encoding means those never reach the server at all. Nobody asked for that; it's the right
 * default anyway, and it's a reason not to "optimise" this into a straight passthrough upload.
 *
 * The canvas never exceeds 1400px on its long edge. Older iPhones cap canvas backing stores near
 * 16 MP and, above that, silently hand back a *blank* canvas rather than throwing — so a 48 MP
 * iPhone photo would upload as a black rectangle with no error anywhere. Sizing the canvas to the
 * output rather than the input is what keeps us three orders of magnitude clear of that ceiling.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new PhotoError("tooLarge", "That file is too large to process.");
  }

  const { url, img } = await measure(file);

  try {
    const target = targetSize(img.naturalWidth, img.naturalHeight);

    /*
     * createImageBitmap is the better path when it exists: it decodes off the main thread, applies
     * EXIF orientation itself, and resizes during decode so the full-resolution bitmap is never
     * allocated. It's missing or partial in some in-app webviews, which is why the <img> we already
     * decoded stays around as the fallback source rather than being a separate code path.
     */
    let source: CanvasImageSource = img;
    let sourceWidth = img.naturalWidth;
    let sourceHeight = img.naturalHeight;
    let bitmap: ImageBitmap | null = null;

    if (typeof createImageBitmap === "function") {
      try {
        bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
          resizeWidth: target.width,
          resizeHeight: target.height,
          resizeQuality: "high",
        });
        source = bitmap;
        sourceWidth = bitmap.width;
        sourceHeight = bitmap.height;
      } catch {
        // Fall through to the <img> path. Not an error the guest needs to hear about.
        bitmap = null;
      }
    }

    try {
      const canvas = drawDownscaled(source, sourceWidth, sourceHeight, target);

      let blob = await encode(canvas, QUALITY);
      if (blob.size > MAX_OUTPUT_BYTES) {
        // One retry at lower quality. A 1400px JPEG over 3 MB means extreme detail, not a bug.
        blob = await encode(canvas, FALLBACK_QUALITY);
      }
      if (blob.size > MAX_OUTPUT_BYTES) {
        throw new PhotoError("tooLarge", "The encoded image is still too large.");
      }

      return {
        blob,
        previewUrl: URL.createObjectURL(blob),
        width: target.width,
        height: target.height,
      };
    } finally {
      bitmap?.close();
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
