/**
 * Dynamic OGP Image Generator
 *
 * Generates Open Graph Protocol images for social media sharing.
 * - Fetches latest painting from R2 storage
 * - Resizes image to 1200×630 with black background
 */

import { env } from "@/env";
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

  logger.info("ogp.step4-build-url");
  // Step 4: Build image URL and fetch with Cloudflare Image Transformations
  const keySegments = imageKey.split("/").map(segment => encodeURIComponent(segment));
  const keyPath = keySegments.join("/");
  let baseImageUrl: string;
  let useInternalRoute = false;

  if (env.NEXT_PUBLIC_R2_URL) {
    // Remove trailing slashes
    const url = env.NEXT_PUBLIC_R2_URL.replace(/\/+$/, "");

    // Check if URL already includes protocol
    if (url.startsWith("http://") || url.startsWith("https://")) {
      // Already has protocol, use as-is
      baseImageUrl = `${url}/${keyPath}`;
    } else {
      // No protocol, determine based on domain
      const protocol = url.startsWith("localhost") ? "http" : "https";
      baseImageUrl = `${protocol}://${url}/${keyPath}`;
    }
  } else {
    const origin = new URL(requestUrl).origin;
    baseImageUrl = `${origin}/api/r2/${keyPath}`;
    useInternalRoute = true;
  }

  logger.info("ogp.step4-url-built", { baseImageUrl, useInternalRoute });

  logger.info("ogp.step5-transform-image");
  // Step 5: Convert WebP to PNG with black background padding using Cloudflare Image Transformations
  let imageResponse = await fetch(baseImageUrl, {
    cf: {
      image: {
        width: 1200,
        height: 630,
        fit: "pad",
        format: "png",
        background: "000000", // Black background for padding
      },
    },
  } as RequestInit);

  let contentType = imageResponse.headers.get("Content-Type") || "";
  let isPng = contentType.includes("image/png");

  // Retry logic: if public URL failed to transform (e.g. R2 dev URL without resizing), try internal route
  if ((!imageResponse.ok || !isPng) && !useInternalRoute) {
    const reason = !imageResponse.ok
      ? `Public URL returned HTTP ${imageResponse.status}`
      : `Public URL returned non-PNG content-type: ${contentType}`;
    logger.warn("ogp.step5-public-url-failed-retrying-internal", {
      reason,
      status: imageResponse.status,
      contentType,
      isPng,
      baseImageUrl,
      note: "Retrying with internal /api/r2/ route and X-Allow-R2-Route header",
    });

    const origin = new URL(requestUrl).origin;
    baseImageUrl = `${origin}/api/r2/${keyPath}`;

    imageResponse = await fetch(baseImageUrl, {
      headers: { "X-Allow-R2-Route": "true" },
      cf: {
        image: {
          width: 1200,
          height: 630,
          fit: "pad",
          format: "png",
          background: "000000", // Black background for padding
        },
      },
    } as RequestInit);

    contentType = imageResponse.headers.get("Content-Type") || "";
    isPng = contentType.includes("image/png");
  }

  if (!imageResponse.ok) {
    const transformFailedReason = `Image transformation failed: HTTP ${imageResponse.status} ${imageResponse.statusText}`;
    logger.error("ogp.step5-transform-failed", {
      reason: transformFailedReason,
      status: imageResponse.status,
      statusText: imageResponse.statusText,
      baseImageUrl,
      useInternalRoute,
      willFallback: true,
      fallbackReason: "Using fallback PNG image with transformation",
    });
    // Fallback: use fallback PNG image with Cloudflare Image Transformations
    if (assetsFetcher) {
      const origin = new URL(requestUrl).origin;
      const fallbackUrl = `${origin}/og-fallback.png`;

      logger.info("ogp.step5-fallback-transform", { fallbackUrl });
      const fallbackResponse = await fetch(fallbackUrl, {
        cf: {
          image: {
            width: 1200,
            height: 630,
            fit: "pad",
            format: "png",
            background: "000000", // Black background for padding
          },
        },
      } as RequestInit);

      if (fallbackResponse.ok) {
        const fallbackContentType = fallbackResponse.headers.get("Content-Type") || "";
        const fallbackIsPng = fallbackContentType.includes("image/png");
        if (fallbackIsPng) {
          const fallbackBuffer = await fallbackResponse.arrayBuffer();
          logger.info("ogp.step5-fallback-transform-success", {
            contentType: fallbackContentType,
            pngSizeBytes: fallbackBuffer.byteLength,
            pngSizeKB: (fallbackBuffer.byteLength / 1024).toFixed(2),
          });
          return fallbackBuffer;
        }
      }

      // If transformation failed, return original fallback image
      const fallbackReason = fallbackResponse.ok
        ? `Fallback image transformation returned non-PNG: ${fallbackResponse.headers.get("Content-Type")}`
        : `Fallback image transformation failed: HTTP ${fallbackResponse.status}`;
      logger.error("ogp.step5-fallback-transform-failed", {
        reason: fallbackReason,
        status: fallbackResponse.status,
        contentType: fallbackResponse.headers.get("Content-Type"),
        fallbackUrl,
        willUseOriginalFallback: true,
      });
      const fallbackDataUrl = await getFallbackImageDataUrl(assetsFetcher);
      const fallbackBuffer = await fetch(fallbackDataUrl).then(r => r.arrayBuffer());
      return fallbackBuffer;
    }
    const noFallbackReason = "ASSETS fetcher not available for fallback";
    logger.error("ogp.step5-no-fallback-available", {
      reason: noFallbackReason,
      willThrow: true,
    });
    throw new Error(`Cannot use WebP image and ${noFallbackReason}`);
  }

  const transformedBuffer = await imageResponse.arrayBuffer();
  // Update content type after buffer read (headers are already from final response)
  contentType = imageResponse.headers.get("Content-Type") || "";
  isPng = contentType.includes("image/png");

  // Verify that transformation actually worked
  // In local dev, cf.image might not work, so check Content-Type
  if (!isPng) {
    const transformNotAppliedReason = `Cloudflare Image Transformations not applied: received ${contentType} instead of image/png. Size unchanged (${imageResult.value.byteLength} -> ${transformedBuffer.byteLength} bytes)`;
    logger.error("ogp.step5-transform-not-applied", {
      reason: transformNotAppliedReason,
      contentType,
      isPng,
      originalSize: imageResult.value.byteLength,
      transformedSize: transformedBuffer.byteLength,
      baseImageUrl,
      useInternalRoute,
      willFallback: true,
      fallbackReason: "cf.image transformation not applied - using fallback PNG image with transformation",
    });
    // Fallback: use fallback PNG image with Cloudflare Image Transformations
    if (assetsFetcher) {
      const origin = new URL(requestUrl).origin;
      const fallbackUrl = `${origin}/og-fallback.png`;

      logger.info("ogp.step5-fallback-transform", { fallbackUrl });
      const fallbackResponse = await fetch(fallbackUrl, {
        cf: {
          image: {
            width: 1200,
            height: 630,
            fit: "pad",
            format: "png",
            background: "000000", // Black background for padding
          },
        },
      } as RequestInit);

      if (fallbackResponse.ok) {
        const fallbackContentType = fallbackResponse.headers.get("Content-Type") || "";
        const fallbackIsPng = fallbackContentType.includes("image/png");
        if (fallbackIsPng) {
          const fallbackBuffer = await fallbackResponse.arrayBuffer();
          logger.info("ogp.step5-fallback-transform-success", {
            contentType: fallbackContentType,
            pngSizeBytes: fallbackBuffer.byteLength,
            pngSizeKB: (fallbackBuffer.byteLength / 1024).toFixed(2),
          });
          return fallbackBuffer;
        }
      }

      // If transformation failed, return original fallback image
      const fallbackTransformFailedReason = fallbackResponse.ok
        ? `Fallback image transformation returned non-PNG: ${fallbackResponse.headers.get("Content-Type")}`
        : `Fallback image transformation failed: HTTP ${fallbackResponse.status}`;
      logger.error("ogp.step5-fallback-transform-failed", {
        reason: fallbackTransformFailedReason,
        status: fallbackResponse.status,
        contentType: fallbackResponse.headers.get("Content-Type"),
        fallbackUrl,
        willUseOriginalFallback: true,
      });
      const fallbackDataUrl = await getFallbackImageDataUrl(assetsFetcher);
      const fallbackBuffer = await fetch(fallbackDataUrl).then(r => r.arrayBuffer());
      return fallbackBuffer;
    }
    const noFallbackReason2 = "ASSETS fetcher not available for fallback";
    logger.error("ogp.step5-no-fallback-available", {
      reason: noFallbackReason2,
      willThrow: true,
    });
    throw new Error(`Cannot use WebP image and ${noFallbackReason2}`);
  }

  logger.info("ogp.step5-transform-success", {
    contentType,
    pngSizeBytes: transformedBuffer.byteLength,
    pngSizeKB: (transformedBuffer.byteLength / 1024).toFixed(2),
  });

  return transformedBuffer;
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
        // Use og-fallback.png with Cloudflare Image Transformations to resize to 1200x630 with black background
        const requestUrl = getBaseUrl();
        const origin = new URL(requestUrl).origin;
        const fallbackUrl = `${origin}/og-fallback.png`;

        logger.info("ogp.fallback-transform", { fallbackUrl });
        const fallbackResponse = await fetch(fallbackUrl, {
          cf: {
            image: {
              width: 1200,
              height: 630,
              fit: "pad",
              format: "png",
              background: "000000", // Black background for padding
            },
          },
        } as RequestInit);

        if (fallbackResponse.ok) {
          const fallbackContentType = fallbackResponse.headers.get("Content-Type") || "";
          const fallbackIsPng = fallbackContentType.includes("image/png");
          if (fallbackIsPng) {
            const fallbackBuffer = await fallbackResponse.arrayBuffer();
            logger.info("ogp.fallback-transform-success", {
              contentType: fallbackContentType,
              pngSizeBytes: fallbackBuffer.byteLength,
              pngSizeKB: (fallbackBuffer.byteLength / 1024).toFixed(2),
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
          }
        }

        // If transformation failed, return original fallback image
        const fallbackReason = fallbackResponse.ok
          ? `Fallback image transformation returned non-PNG: ${fallbackResponse.headers.get("Content-Type")}`
          : `Fallback image transformation failed: HTTP ${fallbackResponse.status}`;
        logger.error("ogp.fallback-transform-failed", {
          reason: fallbackReason,
          status: fallbackResponse.status,
          contentType: fallbackResponse.headers.get("Content-Type"),
          fallbackUrl,
          willUseOriginalFallback: true,
        });
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
