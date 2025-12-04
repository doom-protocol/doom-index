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
export const revalidate = 60;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "DOOM INDEX - A decentralized archive of financial emotions.";

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
  requestUrl: string,
  assetsFetcher?: Fetcher,
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
  // Step 4: Transform image using IMAGES binding directly (no fetch needed)
  try {
    const { env: cfEnv } = await getCloudflareContext({ async: true });
    const images = cfEnv.IMAGES;

    if (!images) {
      const reason = "IMAGES binding not available";
      logger.error("ogp.step4-images-binding-unavailable", {
        reason,
        willFallback: true,
      });
      throw new Error(reason);
    }

    logger.info("ogp.step4-images-binding-found");

    // Build transform options
    const imageTransform: ImageTransform = {
      width: 1200,
      height: 630,
      fit: "pad",
      background: "000000", // Black background for padding
    };

    // Build output options
    const outputOptions: ImageOutputOptions = {
      format: "image/png",
    };

    logger.info("ogp.step4-applying-transformation", {
      transform: imageTransform,
      output: outputOptions,
    });

    // Convert ArrayBuffer to ReadableStream
    const bodyStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(imageResult.value!));
        controller.close();
      },
    });

    // Apply transformation using IMAGES binding
    const transformer = images.input(bodyStream);
    const transformedResult = await transformer.transform(imageTransform).output(outputOptions);

    const contentType = transformedResult.contentType();
    const isPng = contentType.includes("image/png");

    if (!isPng) {
      const reason = `Transformation returned non-PNG content-type: ${contentType}`;
      logger.error("ogp.step4-transform-wrong-format", {
        reason,
        contentType,
        willFallback: true,
      });
      throw new Error(reason);
    }

    // Get the transformed image as ArrayBuffer
    const transformedStream = transformedResult.image();
    const transformedBuffer = await new Response(transformedStream).arrayBuffer();

    logger.info("ogp.step4-transform-success", {
      contentType,
      pngSizeBytes: transformedBuffer.byteLength,
      pngSizeKB: (transformedBuffer.byteLength / 1024).toFixed(2),
      originalSize: imageResult.value.byteLength,
      originalSizeKB: (imageResult.value.byteLength / 1024).toFixed(2),
    });

    return transformedBuffer;
  } catch (transformError) {
    const transformErrorMessage = transformError instanceof Error ? transformError.message : String(transformError);
    const reason = `IMAGES binding transformation failed: ${transformErrorMessage}`;
    logger.error("ogp.step4-transform-error", {
      reason,
      error: transformErrorMessage,
      errorStack: transformError instanceof Error ? transformError.stack : undefined,
      willFallback: true,
    });

    // Fallback: use fallback PNG image with IMAGES binding
    if (assetsFetcher) {
      logger.info("ogp.step4-fallback-transform");
      try {
        const fallbackResponse = await assetsFetcher.fetch("/og-fallback.png");
        if (!fallbackResponse.ok) {
          throw new Error(`Failed to fetch fallback image: ${fallbackResponse.status}`);
        }

        const fallbackBuffer = await fallbackResponse.arrayBuffer();
        const { env: cfEnv } = await getCloudflareContext({ async: true });
        const images = cfEnv.IMAGES;

        if (images) {
          const imageTransform: ImageTransform = {
            width: 1200,
            height: 630,
            fit: "pad",
            background: "000000", // Black background for padding
          };

          const outputOptions: ImageOutputOptions = {
            format: "image/png",
          };

          const fallbackStream = new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(fallbackBuffer));
              controller.close();
            },
          });

          const transformer = images.input(fallbackStream);
          const transformedResult = await transformer.transform(imageTransform).output(outputOptions);

          const fallbackContentType = transformedResult.contentType();
          const fallbackIsPng = fallbackContentType.includes("image/png");

          if (fallbackIsPng) {
            const transformedFallbackStream = transformedResult.image();
            const transformedFallbackBuffer = await new Response(transformedFallbackStream).arrayBuffer();

            logger.info("ogp.step4-fallback-transform-success", {
              contentType: fallbackContentType,
              pngSizeBytes: transformedFallbackBuffer.byteLength,
              pngSizeKB: (transformedFallbackBuffer.byteLength / 1024).toFixed(2),
            });
            return transformedFallbackBuffer;
          }
        }

        // If transformation failed, return original fallback image
        logger.warn("ogp.step4-fallback-transform-failed", {
          reason: "Fallback image transformation failed or returned non-PNG",
          willUseOriginalFallback: true,
        });
        return fallbackBuffer;
      } catch (fallbackError) {
        const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        logger.error("ogp.step4-fallback-error", {
          reason: `Fallback image processing failed: ${fallbackErrorMessage}`,
          error: fallbackErrorMessage,
          willThrow: true,
        });
        throw new Error(`Fallback image processing failed: ${fallbackErrorMessage}`);
      }
    }

    const noFallbackReason = "ASSETS fetcher not available for fallback";
    logger.error("ogp.step4-no-fallback-available", {
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
    const response = await assetsFetcher.fetch("/frame.webp");
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return arrayBufferToDataUrl(buffer, "image/webp");
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

    logger.info("ogp.step-init-url");
    // Get request URL
    const requestUrl = getBaseUrl();
    logger.info("ogp.step-init-url-success", { requestUrl });

    logger.info("ogp.step-fetch-current-painting");
    // Fetch current painting image (already transformed to PNG with black background)
    const imageBuffer = await getCurrentPaintingImageBuffer(r2Bucket, db, requestUrl, assetsFetcher);
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
      const assetsFetcher = env.ASSETS;

      if (assetsFetcher) {
        logger.info("ogp.fallback-load-image");
        // Use og-fallback.png with IMAGES binding to resize to 1200x630 with black background
        try {
          const fallbackResponse = await assetsFetcher.fetch("/og-fallback.png");
          if (!fallbackResponse.ok) {
            throw new Error(`Failed to fetch fallback image: ${fallbackResponse.status}`);
          }

          const fallbackBuffer = await fallbackResponse.arrayBuffer();
          const { env: cfEnv } = await getCloudflareContext({ async: true });
          const images = cfEnv.IMAGES;

          if (images) {
            logger.info("ogp.fallback-transform");
            const imageTransform: ImageTransform = {
              width: 1200,
              height: 630,
              fit: "pad",
              background: "000000", // Black background for padding
            };

            const outputOptions: ImageOutputOptions = {
              format: "image/png",
            };

            const fallbackStream = new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(fallbackBuffer));
                controller.close();
              },
            });

            const transformer = images.input(fallbackStream);
            const transformedResult = await transformer.transform(imageTransform).output(outputOptions);

            const fallbackContentType = transformedResult.contentType();
            const fallbackIsPng = fallbackContentType.includes("image/png");

            if (fallbackIsPng) {
              const transformedFallbackStream = transformedResult.image();
              const transformedFallbackBuffer = await new Response(transformedFallbackStream).arrayBuffer();

              logger.info("ogp.fallback-transform-success", {
                contentType: fallbackContentType,
                pngSizeBytes: transformedFallbackBuffer.byteLength,
                pngSizeKB: (transformedFallbackBuffer.byteLength / 1024).toFixed(2),
              });

              logger.info("ogp.fallback-completed", {
                durationMs: Date.now() - startTime,
              });

              return new Response(transformedFallbackBuffer, {
                status: 200,
                headers: {
                  "Content-Type": "image/png",
                  "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS.ONE_MINUTE}`,
                },
              });
            }
          }

          // If transformation failed, return original fallback image
          logger.warn("ogp.fallback-transform-failed", {
            reason: "Fallback image transformation failed or returned non-PNG",
            willUseOriginalFallback: true,
          });

          logger.info("ogp.fallback-completed", {
            durationMs: Date.now() - startTime,
          });

          return new Response(fallbackBuffer, {
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

          // Last resort: return original fallback image
          const fallbackDataUrl = await getFallbackImageDataUrl(assetsFetcher);
          const fallbackBuffer = await fetch(fallbackDataUrl).then(r => r.arrayBuffer());

          logger.info("ogp.fallback-completed", {
            durationMs: Date.now() - startTime,
          });

          return new Response(fallbackBuffer, {
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
