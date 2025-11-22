/**
 * Dynamic OGP Image Generator
 *
 * Generates Open Graph Protocol images for social media sharing.
 * - Fetches latest artwork from R2 storage
 * - Resizes image to 1200×630 with black background
 */

import { ImageResponse } from "next/og";
import { getImageR2 } from "@/lib/r2";
import { arrayBufferToDataUrl } from "@/utils/image";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getBaseUrl } from "@/utils/url";
import { logger } from "@/utils/logger";
import { createPaintingsRepository } from "@/repositories/paintings-repository";
import { env } from "@/env";

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
 * Fetch artwork image from R2 and return an image src usable by <img>.
 * - Prefer Cloudflare Image Transformations to get PNG (Satori-friendly)
 * - If transformation not applied (e.g., local dev), return absolute URL to static fallback PNG
 */
async function getArtworkImageSrc(
  bucket: R2Bucket,
  db: D1Database,
  requestUrl: string,
  assetsFetcher?: Fetcher,
): Promise<string> {
  logger.info("ogp.step1-fetch-state");
  // Step 1: Fetch latest painting from D1
  const repo = createPaintingsRepository({ d1Binding: db });
  const listResult = await repo.list({ limit: 1 });

  if (listResult.isErr() || listResult.value.items.length === 0) {
    logger.warn("ogp.step1-state-failed", {
      error: listResult.isErr() ? listResult.error.message : "No paintings found",
    });
    throw new Error("Failed to fetch state or no paintings found");
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
    logger.warn("ogp.step3-image-failed", {
      error: imageResult.isErr() ? imageResult.error.message : "No image data",
    });
    throw new Error("Failed to fetch image from R2");
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

  if (env.NEXT_PUBLIC_R2_DOMAIN) {
    // Remove trailing slashes
    let domain = env.NEXT_PUBLIC_R2_DOMAIN.replace(/\/+$/, "");

    // Check if URL already includes protocol
    if (domain.startsWith("http://") || domain.startsWith("https://")) {
      // Already has protocol, use as-is
      baseImageUrl = `${domain}/${keyPath}`;
    } else {
      // No protocol, determine based on domain
      const protocol = domain.startsWith("localhost") ? "http" : "https";
      baseImageUrl = `${protocol}://${domain}/${keyPath}`;
    }
  } else {
    const origin = new URL(requestUrl).origin;
    baseImageUrl = `${origin}/api/r2/${keyPath}`;
  }

  logger.info("ogp.step4-url-built", { baseImageUrl });

  logger.info("ogp.step5-transform-image");
  // Step 5: Convert WebP to PNG using Cloudflare Image Transformations
  const imageResponse = await fetch(baseImageUrl, {
    cf: {
      image: {
        width: 1200,
        height: 630,
        fit: "contain",
        format: "png",
      },
    },
  } as RequestInit);

  if (!imageResponse.ok) {
    logger.warn("ogp.step5-transform-failed", {
      status: imageResponse.status,
      statusText: imageResponse.statusText,
      note: "Using fallback PNG image",
    });
    // Fallback: use fallback PNG image if transformation fails
    // Satori doesn't support WebP, so we need PNG
    if (assetsFetcher) {
      return await getFallbackImageDataUrl(assetsFetcher);
    }
    throw new Error("Cannot use WebP image and ASSETS fetcher not available for fallback");
  }

  const transformedBuffer = await imageResponse.arrayBuffer();
  const contentType = imageResponse.headers.get("Content-Type") || "";
  const isPng = contentType.includes("image/png");
  const sizeChanged = transformedBuffer.byteLength !== imageResult.value.byteLength;

  // Verify that transformation actually worked
  // In local dev, cf.image might not work, so check Content-Type and size
  if (!isPng || !sizeChanged) {
    logger.warn("ogp.step5-transform-not-applied", {
      contentType,
      isPng,
      originalSize: imageResult.value.byteLength,
      transformedSize: transformedBuffer.byteLength,
      sizeChanged,
      note: "cf.image may not work in local dev - using fallback PNG image",
    });
    // Fallback: prefer returning absolute URL to the static PNG to avoid huge data URLs in Satori
    const origin = new URL(requestUrl).origin;
    return `${origin}/og-fallback.png`;
  }

  logger.info("ogp.step5-transform-success", {
    contentType,
    pngSizeBytes: transformedBuffer.byteLength,
    pngSizeKB: (transformedBuffer.byteLength / 1024).toFixed(2),
  });

  return arrayBufferToDataUrl(transformedBuffer, "image/png");
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
export async function getArtworkDataUrl(
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
 * Generate OGP image using ImageResponse
 */
export default async function Image(): Promise<ImageResponse> {
  const startTime = Date.now();
  logger.info("ogp.start");

  try {
    logger.info("ogp.step-init-context");
    // Get Cloudflare context
    const { env } = await getCloudflareContext({ async: true });
    const cloudflareEnv = env as Cloudflare.Env;
    const r2Bucket = cloudflareEnv.R2_BUCKET as R2Bucket | undefined;
    const db = cloudflareEnv.DB as D1Database | undefined;

    if (!r2Bucket) {
      logger.warn("ogp.step-init-no-bucket");
      throw new Error("R2_BUCKET not available");
    }

    if (!db) {
      logger.warn("ogp.step-init-no-db");
      throw new Error("DB not available");
    }

    const assetsFetcher = cloudflareEnv.ASSETS as Fetcher | undefined;

    logger.info("ogp.step-init-success", {
      hasBucket: !!r2Bucket,
      hasDb: !!db,
      hasAssets: !!assetsFetcher,
    });

    logger.info("ogp.step-init-url");
    // Get request URL
    const requestUrl = getBaseUrl();
    logger.info("ogp.step-init-url-success", { requestUrl });

    logger.info("ogp.step-fetch-artwork");
    // Fetch artwork image
    const dataUrl = await getArtworkImageSrc(r2Bucket, db, requestUrl, assetsFetcher);
    logger.info("ogp.step-fetch-artwork-success", {
      dataUrlLength: dataUrl.length,
      dataUrlLengthKB: (dataUrl.length / 1024).toFixed(2),
    });

    logger.info("ogp.step-render");
    // Render image with black background
    const jsxElement = (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "#000000",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={dataUrl}
          alt=""
          width={size.width}
          height={size.height}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    );

    const imageResponse = new ImageResponse(jsxElement, {
      width: size.width,
      height: size.height,
    });

    logger.info("ogp.step-render-success");
    const arrayBuffer = await imageResponse.arrayBuffer();

    logger.info("ogp.step-create-response", {
      arrayBufferSize: arrayBuffer.byteLength,
      arrayBufferSizeKB: (arrayBuffer.byteLength / 1024).toFixed(2),
    });

    const response = new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
      },
    }) as unknown as ImageResponse;

    logger.info("ogp.completed", {
      durationMs: Date.now() - startTime,
    });

    return response;
  } catch (error) {
    logger.warn("ogp.fallback", {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    try {
      // Get ASSETS fetcher for fallback image
      const { env } = await getCloudflareContext({ async: true });
      const cloudflareEnv = env as Cloudflare.Env;
      const assetsFetcher = cloudflareEnv.ASSETS as Fetcher | undefined;

      if (assetsFetcher) {
        logger.info("ogp.fallback-load-image");
        // Use og-fallback.png (600x600 PNG)
        const fallbackDataUrl = await getFallbackImageDataUrl(assetsFetcher);

        logger.info("ogp.fallback-render");
        // Render fallback image with black background
        const fallbackJsx = (
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "100%",
              backgroundColor: "#000000",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={fallbackDataUrl}
              alt=""
              width={600}
              height={600}
              style={{
                height: "100%",
                width: "auto",
                objectFit: "contain",
              }}
            />
          </div>
        );

        const fallbackResponse = new ImageResponse(fallbackJsx, {
          width: size.width,
          height: size.height,
        });

        const fallbackBuffer = await fallbackResponse.arrayBuffer();
        logger.info("ogp.fallback-completed", {
          durationMs: Date.now() - startTime,
        });

        return new Response(fallbackBuffer, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=60",
          },
        }) as unknown as ImageResponse;
      }
    } catch (fallbackError) {
      logger.warn("ogp.fallback-image-error", {
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
    }

    // Last resort: return simple black image with text
    const textFallbackJsx = (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "#000000",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: 40,
          fontWeight: "bold",
        }}
      >
        DOOM INDEX
      </div>
    );

    const textFallbackResponse = new ImageResponse(textFallbackJsx, {
      width: size.width,
      height: size.height,
    });

    const textFallbackBuffer = await textFallbackResponse.arrayBuffer();
    logger.info("ogp.fallback-text-completed", {
      durationMs: Date.now() - startTime,
    });

    return new Response(textFallbackBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60",
      },
    }) as unknown as ImageResponse;
  }
}
