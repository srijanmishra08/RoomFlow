// Browser-only image re-encoding. Serverless request bodies are capped at
// ~4.5 MB, so large renders/panoramas are shrunk to WebP here before upload.

export interface EncodedImage {
  blob: Blob;
  width: number;
  height: number;
  /** "webp" normally; "png" if the browser can't encode WebP. */
  ext: "webp" | "png";
}

export interface EncodeOptions {
  /** Longest-side-independent width cap in pixels. Default: no cap. */
  maxWidth?: number;
  /** Byte budget for the result. Default 4,000,000. */
  limitBytes?: number;
}

const QUALITIES = [0.92, 0.85, 0.75, 0.6, 0.45];

async function toBitmap(source: Blob | string): Promise<ImageBitmap> {
  const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
  return createImageBitmap(blob);
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

/** Re-encode an image (Blob or data/object URL) as WebP within a size budget. */
export async function encodeWebp(source: Blob | string, opts: EncodeOptions = {}): Promise<EncodedImage> {
  const { maxWidth, limitBytes = 4_000_000 } = opts;
  const bitmap = await toBitmap(source);
  try {
    let scale = maxWidth && bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
    // Quality ladder first; if even the lowest quality is too big, shrink and retry.
    for (let attempt = 0; attempt < 4; attempt++) {
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not available in this browser.");
      ctx.drawImage(bitmap, 0, 0, w, h);

      let last: Blob | null = null;
      for (const q of QUALITIES) {
        const blob = await canvasToBlob(canvas, q);
        if (!blob) throw new Error("Could not encode the image.");
        last = blob;
        if (blob.size <= limitBytes) {
          return { blob, width: w, height: h, ext: blob.type === "image/webp" ? "webp" : "png" };
        }
        // A browser without WebP encoding returns PNG regardless of quality;
        // retrying qualities can't help, so go straight to shrinking.
        if (blob.type !== "image/webp") break;
      }
      if (attempt === 3 && last) {
        return { blob: last, width: w, height: h, ext: last.type === "image/webp" ? "webp" : "png" };
      }
      scale *= 0.75;
    }
    throw new Error("Could not fit the image within the size limit.");
  } finally {
    bitmap.close();
  }
}

/** Read an image's pixel size without keeping it in memory. */
export async function imageSize(source: Blob | string): Promise<{ width: number; height: number }> {
  const bitmap = await toBitmap(source);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/** Equirectangular panoramas are 2:1. Allow a little slack for odd crops. */
export function isEquirectangular(width: number, height: number): boolean {
  if (!width || !height) return false;
  const ratio = width / height;
  return ratio > 1.85 && ratio < 2.15;
}
