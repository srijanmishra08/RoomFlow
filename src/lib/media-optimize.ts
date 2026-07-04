// Upload-time media optimization: compress GLB meshes (Draco) and raster
// images (WebP) before they hit Blob storage. Every function fails open —
// if compression errors for any reason, the original buffer is returned
// unchanged so an upload never breaks on an optimization bug.

import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { draco } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";

const MAX_IMAGE_DIMENSION = 2048; // longest side, px — covers phone photos
const THUMBNAIL_WIDTH = 400;

export interface OptimizedImage {
  buffer: Buffer;
  ext: "webp";
  contentType: "image/webp";
}

/** Re-encode a raster image as WebP, capped to a sane max dimension. */
export async function optimizeImage(buffer: Buffer): Promise<OptimizedImage> {
  try {
    const out = await sharp(buffer)
      .rotate() // apply EXIF orientation before stripping metadata
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { buffer: out, ext: "webp", contentType: "image/webp" };
  } catch (err) {
    console.error("optimizeImage failed, using original:", err);
    return { buffer, ext: "webp", contentType: "image/webp" }; // caller falls back on size check
  }
}

/** Small WebP preview for asset-library grid views. */
export async function generateThumbnail(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer)
      .rotate()
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();
  } catch (err) {
    console.error("generateThumbnail failed:", err);
    return null;
  }
}

let encoderModule: unknown = null;
async function getEncoderModule() {
  encoderModule ??= await draco3d.createEncoderModule();
  return encoderModule;
}

/**
 * Draco-compress a self-contained GLB buffer. Only GLB (binary, embedded
 * buffers) is supported — .gltf/.obj/.fbx pass through untouched, since
 * they may reference external resources NodeIO can't resolve without a
 * filesystem.
 */
export async function optimizeGLB(buffer: Buffer): Promise<Buffer> {
  try {
    const io = new NodeIO()
      .registerExtensions([KHRDracoMeshCompression])
      .registerDependencies({ "draco3d.encoder": await getEncoderModule() });
    const document = await io.readBinary(new Uint8Array(buffer));
    await document.transform(draco({ method: "edgebreaker" }));
    const out = await io.writeBinary(document);
    return Buffer.from(out);
  } catch (err) {
    console.error("optimizeGLB failed, using original:", err);
    return buffer;
  }
}
