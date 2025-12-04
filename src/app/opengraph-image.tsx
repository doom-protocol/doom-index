/**
 * Dynamic OGP Image Generator
 *
 * Generates Open Graph Protocol images for social media sharing.
 * - Fetches latest painting from R2 storage
 * - Resizes image to 1200×630 with black background
 */

import { getImageR2 } from "@/lib/r2";
import { CACHE_TTL_SECONDS } from "@/constants";
import { createPaintingsRepository } from "@/repositories/paintings-repository";
import { arrayBufferToDataUrl } from "@/utils/image";
import { logger } from "@/utils/logger";
import { getBaseUrl } from "@/utils/url";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Route Segment Config
export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1 hour
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "DOOM INDEX - A decentralized archive of financial emotions.";

const FRAME_SCALE = 0.94;
const FRAME_SIZE = {
  width: Math.round(size.width * FRAME_SCALE),
  height: Math.round(size.height * FRAME_SCALE),
};
const FRAME_OFFSET = {
  left: Math.round((size.width - FRAME_SIZE.width) / 2),
  top: Math.round((size.height - FRAME_SIZE.height) / 2),
};
const PAINTING_SCALE_WITHIN_FRAME = 0.78;
const PAINTING_TARGET_SIZE = Math.round(Math.min(FRAME_SIZE.width, FRAME_SIZE.height) * PAINTING_SCALE_WITHIN_FRAME);
const PAINTING_OFFSET = {
  left: FRAME_OFFSET.left + Math.round((FRAME_SIZE.width - PAINTING_TARGET_SIZE) / 2),
  top: FRAME_OFFSET.top + Math.round((FRAME_SIZE.height - PAINTING_TARGET_SIZE) / 2),
};
const FRAME_IMAGE_PRIMARY_PATH = "/frame.png";

const BACKGROUND_IMAGE_PATH = "/ogp-bg.png";
const FALLBACK_BACKGROUND_COLOR = "#000000";
const BLACK_PIXEL_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const BLACK_PIXEL_BYTES = Buffer.from(BLACK_PIXEL_BASE64, "base64");
const BLACK_PIXEL_ARRAY_BUFFER = BLACK_PIXEL_BYTES.buffer.slice(
  BLACK_PIXEL_BYTES.byteOffset,
  BLACK_PIXEL_BYTES.byteOffset + BLACK_PIXEL_BYTES.byteLength,
);

function createReadableStreamFromArrayBuffer(buffer: ArrayBuffer): ReadableStream<Uint8Array> {
  const chunk = new Uint8Array(buffer);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function renderPaintingOnCanvas(
  paintingBuffer: ArrayBuffer,
  images: ImagesBinding,
  frameBuffer?: ArrayBuffer | null,
  backgroundBuffer?: ArrayBuffer | null,
): Promise<ArrayBuffer> {
  const backgroundStream = createReadableStreamFromArrayBuffer((backgroundBuffer ?? BLACK_PIXEL_ARRAY_BUFFER).slice(0));
  const backgroundTransform: ImageTransform = {
    width: size.width,
    height: size.height,
    fit: "cover",
  };
  if (!backgroundBuffer) {
    backgroundTransform.background = FALLBACK_BACKGROUND_COLOR;
  }
  let composedTransformer = images.input(backgroundStream).transform(backgroundTransform);

  if (frameBuffer) {
    const frameStream = createReadableStreamFromArrayBuffer(frameBuffer.slice(0));
    const frameTransformer = images.input(frameStream).transform({
      width: FRAME_SIZE.width,
      height: FRAME_SIZE.height,
      fit: "cover",
      gravity: "center",
    });
    composedTransformer = composedTransformer.draw(frameTransformer, {
      left: FRAME_OFFSET.left,
      top: FRAME_OFFSET.top,
    });
  }

  const paintingStream = createReadableStreamFromArrayBuffer(paintingBuffer.slice(0));
  const paintingTransformer = images.input(paintingStream).transform({
    width: PAINTING_TARGET_SIZE,
    height: PAINTING_TARGET_SIZE,
    fit: "cover",
    gravity: "center",
  });

  composedTransformer = composedTransformer.draw(paintingTransformer, {
    left: PAINTING_OFFSET.left,
    top: PAINTING_OFFSET.top,
  });

  const transformedResult = await composedTransformer.output({
    format: "image/png",
  });

  const response = transformedResult.response();
  return await response.arrayBuffer();
}

async function getFallbackImageBuffer(assetsFetcher: Fetcher): Promise<ArrayBuffer> {
  logger.info("ogp.fallback-buffer-fetch-start");
  if (!assetsFetcher) {
    throw new Error("ASSETS fetcher not available");
  }
  const baseUrl = getBaseUrl();
  const fallbackUrl = new URL("/og-fallback.png", baseUrl).toString();
  const response = await assetsFetcher.fetch(new Request(fallbackUrl, { method: "GET" }));
  if (!response.ok) {
    throw new Error(`Failed to fetch fallback image: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  logger.info("ogp.fallback-buffer-fetch-success", {
    sizeBytes: buffer.byteLength,
    sizeKB: (buffer.byteLength / 1024).toFixed(2),
  });
  return buffer;
}

async function getFrameImageBuffer(assetsFetcher: Fetcher): Promise<ArrayBuffer | null> {
  try {
    const baseUrl = getBaseUrl();
    const frameUrl = new URL(FRAME_IMAGE_PRIMARY_PATH, baseUrl).toString();
    const response = await assetsFetcher.fetch(new Request(frameUrl, { method: "GET" }));
    if (!response.ok) {
      logger.warn("ogp.frame-fetch-failed", {
        status: response.status,
      });
      return null;
    }
    const buffer = await response.arrayBuffer();
    logger.info("ogp.frame-fetch-success", {
      path: FRAME_IMAGE_PRIMARY_PATH,
      sizeBytes: buffer.byteLength,
      sizeKB: (buffer.byteLength / 1024).toFixed(2),
    });
    return buffer;
  } catch (error) {
    logger.warn("ogp.frame-fetch-error", {
      path: FRAME_IMAGE_PRIMARY_PATH,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function getBackgroundImageBuffer(assetsFetcher?: Fetcher): Promise<ArrayBuffer | null> {
  if (!assetsFetcher) return null;
  try {
    const baseUrl = getBaseUrl();
    const backgroundUrl = new URL(BACKGROUND_IMAGE_PATH, baseUrl).toString();
    const response = await assetsFetcher.fetch(new Request(backgroundUrl, { method: "GET" }));
    if (!response.ok) {
      logger.warn("ogp.background-fetch-failed", {
        status: response.status,
      });
      return null;
    }
    const buffer = await response.arrayBuffer();
    logger.info("ogp.background-fetch-success", {
      sizeBytes: buffer.byteLength,
      sizeKB: (buffer.byteLength / 1024).toFixed(2),
    });
    return buffer;
  } catch (error) {
    logger.warn("ogp.background-fetch-error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Fetch fallback image (og-fallback.png) and convert to data URL
 */
async function getFallbackImageDataUrl(assetsFetcher: Fetcher): Promise<string> {
  logger.info("ogp.fallback-fetch-start");
  try {
    if (!assetsFetcher) {
      throw new Error("ASSETS fetcher not available");
    }

    // Get base URL from getBaseUrl()
    const baseUrl = getBaseUrl();
    const origin = new URL(baseUrl).origin;
    const fullUrl = `${origin}/og-fallback.png`;

    logger.info("ogp.fallback-fetch-url", { fullUrl });

    // Use Request object with full URL from getBaseUrl()
    const request = new Request(fullUrl, { method: "GET" });
    const response = await assetsFetcher.fetch(request);

    if (!response.ok) {
      throw new Error(`Failed to fetch fallback image: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    logger.info("ogp.fallback-fetch-success", {
      sizeBytes: buffer.byteLength,
      sizeKB: (buffer.byteLength / 1024).toFixed(2),
    });

    return arrayBufferToDataUrl(buffer, "image/png");
  } catch (error) {
    logger.warn("ogp.fallback-fetch-error", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Fetch current painting image from R2 and return PNG ArrayBuffer with black background.
 * Uses Cloudflare Image Transformations to resize and add black background padding.
 */
async function getCurrentPaintingImageBuffer(
  bucket: R2Bucket,
  db: D1Database,
  assetsFetcher: Fetcher | undefined,
  imagesBinding: ImagesBinding,
): Promise<ArrayBuffer> {
  logger.info("ogp.step1-fetch-state");
  // Step 1: Fetch latest painting from D1
  const repo = createPaintingsRepository({ d1Binding: db });
  const listResult = await repo.list({ limit: 1 });

  if (listResult.isErr() || listResult.value.items.length === 0) {
    const reason = listResult.isErr()
      ? `repo.list() failed: ${listResult.error.message}`
      : "No paintings found in database";
    logger.error("ogp.step1-state-failed", {
      reason,
      error: listResult.isErr() ? listResult.error.message : "No paintings found",
      willFallback: true,
    });
    throw new Error(`Failed to fetch state: ${reason}`);
  }

  const latestPainting = listResult.value.items[0];

  logger.info("ogp.step1-state-success", {
    imageUrl: latestPainting.imageUrl,
    id: latestPainting.id,
  });

  logger.info("ogp.step2-extract-key");
  // Step 2: Extract R2 key from imageUrl
  const imageUrl = latestPainting.imageUrl;
  let imageKey: string;
  if (imageUrl.startsWith("/api/r2/")) {
    imageKey = imageUrl.slice("/api/r2/".length);
  } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    const url = new URL(imageUrl);
    if (url.pathname.startsWith("/api/r2/")) {
      imageKey = url.pathname.slice("/api/r2/".length);
    } else {
      // Assume it's a direct R2 key if it doesn't match our API route pattern
      imageKey = url.pathname.replace(/^\//, "");
    }
  } else {
    // Assume it's a direct R2 key
    imageKey = imageUrl.replace(/^\//, "");
  }

  logger.info("ogp.step2-key-extracted", { imageKey });

  logger.info("ogp.step3-fetch-image");
  // Step 3: Fetch image from R2
  const imageResult = await getImageR2(bucket, imageKey);
  if (imageResult.isErr() || !imageResult.value) {
    const reason = imageResult.isErr()
      ? `R2 getImageR2() failed: ${imageResult.error.message}`
      : "R2 returned null/empty image data";
    logger.error("ogp.step3-image-failed", {
      reason,
      imageKey,
      error: imageResult.isErr() ? imageResult.error.message : "No image data",
      willFallback: true,
    });
    throw new Error(`Failed to fetch image from R2: ${reason}`);
  }

  logger.info("ogp.step3-image-success", {
    imageSizeBytes: imageResult.value.byteLength,
    imageSizeKB: (imageResult.value.byteLength / 1024).toFixed(2),
  });

  logger.info("ogp.step4-transform-image");
  let frameBuffer: ArrayBuffer | null = null;
  let backgroundBuffer: ArrayBuffer | null = null;
  if (assetsFetcher) {
    [frameBuffer, backgroundBuffer] = await Promise.all([
      getFrameImageBuffer(assetsFetcher),
      getBackgroundImageBuffer(assetsFetcher),
    ]);
  }

  try {
    return await renderPaintingOnCanvas(imageResult.value, imagesBinding, frameBuffer, backgroundBuffer);
  } catch (transformError) {
    const transformErrorMessage = transformError instanceof Error ? transformError.message : String(transformError);
    logger.error("ogp.step4-transform-error", {
      reason: `IMAGES binding transformation failed: ${transformErrorMessage}`,
      error: transformErrorMessage,
      errorStack: transformError instanceof Error ? transformError.stack : undefined,
      willFallback: true,
    });

    if (assetsFetcher) {
      const fallbackBuffer = await getFallbackImageBuffer(assetsFetcher);
      const [fallbackFrameBuffer, fallbackBackgroundBuffer] = await Promise.all([
        frameBuffer ? Promise.resolve(frameBuffer) : getFrameImageBuffer(assetsFetcher),
        backgroundBuffer ? Promise.resolve(backgroundBuffer) : getBackgroundImageBuffer(assetsFetcher),
      ]);
      return await renderPaintingOnCanvas(fallbackBuffer, imagesBinding, fallbackFrameBuffer, fallbackBackgroundBuffer);
    }

    const noFallbackReason = "ASSETS fetcher not available for fallback";
    logger.error("ogp.step5-no-fallback-available", {
      reason: noFallbackReason,
      willThrow: true,
    });
    throw new Error(`Cannot transform image and ${noFallbackReason}`);
  }
}

/**
 * Test-facing helper: Fetch placeholder painting (WEBP) from ASSETS and return as data URL.
 * Returns empty string on failure (for tests expecting graceful fallback).
 */
export async function getPlaceholderDataUrl(assetsFetcher: Fetcher): Promise<string> {
  try {
    const response = await assetsFetcher.fetch("/placeholder-painting.webp");
    if (!response.ok) return "";
    const buffer = await response.arrayBuffer();
    return arrayBufferToDataUrl(buffer, "image/webp");
  } catch {
    return "";
  }
}

/**
 * Test-facing helper: Read state and image from R2, return WEBP data URL, or fallback to placeholder via ASSETS.
 */
export async function getCurrentPaintingDataUrl(
  assetsFetcher: Fetcher,
  bucket: R2Bucket,
  imageKey: string,
): Promise<{ dataUrl: string; fallbackUsed: boolean }> {
  try {
    const imageResult = await getImageR2(bucket, imageKey);
    if (imageResult.isErr() || !imageResult.value) {
      const dataUrl = await getPlaceholderDataUrl(assetsFetcher);
      return { dataUrl, fallbackUsed: true };
    }

    const dataUrl = arrayBufferToDataUrl(imageResult.value, "image/webp");
    return { dataUrl, fallbackUsed: false };
  } catch {
    const dataUrl = await getPlaceholderDataUrl(assetsFetcher);
    return { dataUrl, fallbackUsed: true };
  }
}

/**
 * Test-facing helper: Fetch frame image (WEBP) from ASSETS and return as data URL.
 * Returns null on failure (for tests expecting graceful fallback).
 */
export async function getFrameDataUrl(assetsFetcher: Fetcher): Promise<string | null> {
  try {
    const response = await assetsFetcher.fetch("/frame.png");
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return arrayBufferToDataUrl(buffer, "image/png");
  } catch {
    return null;
  }
}

/**
 * Generate OGP image by directly returning transformed PNG from Cloudflare Image Transformations.
 * Avoids using ImageResponse which requires fs.readFileSync (not available in Cloudflare Workers).
 */
export default async function Image(): Promise<Response> {
  const startTime = Date.now();
  logger.info("ogp.start");

  try {
    logger.info("ogp.step-init-context");
    // Get Cloudflare context
    const { env } = await getCloudflareContext({ async: true });
    const r2Bucket = env.R2_BUCKET;
    const db = env.DB;
    const assetsFetcher = env.ASSETS;
    const imagesBinding = env.IMAGES;

    if (!imagesBinding) {
      throw new Error("IMAGES binding not available in environment");
    }

    logger.info("ogp.step-init-url");
    // Get request URL
    const requestUrl = getBaseUrl();
    logger.info("ogp.step-init-url-success", { requestUrl });

    logger.info("ogp.step-fetch-current-painting");
    // Fetch current painting image (already transformed to PNG with black background)
    const imageBuffer = await getCurrentPaintingImageBuffer(r2Bucket, db, assetsFetcher, imagesBinding);
    logger.info("ogp.step-fetch-current-painting-success", {
      bufferSizeBytes: imageBuffer.byteLength,
      bufferSizeKB: (imageBuffer.byteLength / 1024).toFixed(2),
    });

    logger.info("ogp.step-create-response", {
      arrayBufferSize: imageBuffer.byteLength,
      arrayBufferSizeKB: (imageBuffer.byteLength / 1024).toFixed(2),
    });

    const response = new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS.ONE_MINUTE}, stale-while-revalidate=30`,
      },
    });

    logger.info("ogp.completed", {
      durationMs: Date.now() - startTime,
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const reason = `getCurrentPaintingImageBuffer() failed: ${errorMessage}`;
    logger.error("ogp.fallback", {
      reason,
      error: errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
      durationMs: Date.now() - startTime,
      willUseFallbackImage: true,
    });

    try {
      // Get ASSETS fetcher for fallback image
      const { env } = await getCloudflareContext({ async: true });
      const fallbackAssetsFetcher = env.ASSETS;
      const fallbackImagesBinding = env.IMAGES;

      if (fallbackAssetsFetcher && fallbackImagesBinding) {
        logger.info("ogp.fallback-load-image");
        try {
          const fallbackBuffer = await getFallbackImageBuffer(fallbackAssetsFetcher);
          const [frameBuffer, backgroundBuffer] = await Promise.all([
            getFrameImageBuffer(fallbackAssetsFetcher),
            getBackgroundImageBuffer(fallbackAssetsFetcher),
          ]);
          const transformedFallback = await renderPaintingOnCanvas(
            fallbackBuffer,
            fallbackImagesBinding,
            frameBuffer,
            backgroundBuffer,
          );

          logger.info("ogp.fallback-completed", {
            durationMs: Date.now() - startTime,
          });

          return new Response(transformedFallback, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS.ONE_MINUTE}`,
            },
          });
        } catch (fallbackTransformError) {
          const fallbackTransformErrorMessage =
            fallbackTransformError instanceof Error ? fallbackTransformError.message : String(fallbackTransformError);
          logger.error("ogp.fallback-transform-error", {
            reason: `Fallback image transformation failed: ${fallbackTransformErrorMessage}`,
            error: fallbackTransformErrorMessage,
            willUseOriginalFallback: true,
          });

          const fallbackDataUrl = await getFallbackImageDataUrl(fallbackAssetsFetcher);
          const fallbackBuffer = await fetch(fallbackDataUrl).then(r => r.arrayBuffer());
          const [frameBuffer, backgroundBuffer] = await Promise.all([
            getFrameImageBuffer(fallbackAssetsFetcher),
            getBackgroundImageBuffer(fallbackAssetsFetcher),
          ]);

          logger.info("ogp.fallback-completed", {
            durationMs: Date.now() - startTime,
          });

          const transformedFallback = await renderPaintingOnCanvas(
            fallbackBuffer,
            fallbackImagesBinding,
            frameBuffer,
            backgroundBuffer,
          );

          return new Response(transformedFallback, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS.ONE_MINUTE}`,
            },
          });
        }
      }
    } catch (fallbackError) {
      const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      const reason = `Fallback image loading failed: ${fallbackErrorMessage}`;
      logger.error("ogp.fallback-image-error", {
        reason,
        error: fallbackErrorMessage,
        errorStack: fallbackError instanceof Error ? fallbackError.stack : undefined,
        willUseBlackImage: true,
      });
    }

    // Last resort: return simple black image (1200x630)
    logger.error("ogp.fallback-black-image", {
      reason: "All fallback attempts failed, using minimal black PNG",
      durationMs: Date.now() - startTime,
    });
    // Create a minimal black PNG using data URL
    const blackPngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const blackBuffer = await fetch(blackPngDataUrl).then(r => r.arrayBuffer());

    logger.info("ogp.fallback-black-completed", {
      durationMs: Date.now() - startTime,
    });

    return new Response(blackBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS.ONE_MINUTE}`,
      },
    });
  }
}
