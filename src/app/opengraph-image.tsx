/**
 * Dynamic OGP Image Generator
 *
 * Generates Open Graph Protocol images for social media sharing.
 * - Fetches latest artwork from R2 storage
 * - Converts 1:1 square image to 1200×630 letterbox format
 * - Black background with centered image
 * - Falls back to placeholder on error
 * - ISR: Regenerates every 60 seconds
 */

import { ImageResponse } from "next/og";
import { getJsonR2, getImageR2, resolveR2BucketAsync } from "@/lib/r2";
import { logger } from "@/utils/logger";
import { arrayBufferToDataUrl } from "@/utils/image";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { GlobalState } from "@/types/domain";

// Route Segment Config for ISR
export const dynamic = "force-dynamic"; // Skip static generation at build time
export const revalidate = 60; // Regenerate every 60 seconds
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "DOOM INDEX - Current world state visualization";

/**
 * Fetch placeholder image and convert to data URL
 * Exported for testing
 *
 * @param assetsFetcher - Optional ASSETS fetcher for testing (resolves from context if not provided)
 */
export async function getPlaceholderDataUrl(assetsFetcher?: Fetcher): Promise<string> {
  let fetcher: Fetcher | undefined = assetsFetcher;

  // Resolve ASSETS binding from Cloudflare context if not provided
  if (!fetcher) {
    try {
      const { env } = await getCloudflareContext({ async: true });
      fetcher = (env as Cloudflare.Env | Record<string, unknown>).ASSETS as Fetcher | undefined;
    } catch (error) {
      throw new Error(`Failed to resolve ASSETS binding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!fetcher) {
    throw new Error("ASSETS binding is not available");
  }

  // Use ASSETS fetcher to get static asset directly (avoids circular fetch)
  const response = await fetcher.fetch("/placeholder-painting.webp");

  if (!response.ok) {
    throw new Error(`Failed to fetch placeholder: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return arrayBufferToDataUrl(buffer, "image/webp");
}

/**
 * Fetch frame image and convert to data URL
 * Exported for testing
 *
 * @param assetsFetcher - Optional ASSETS fetcher for testing (resolves from context if not provided)
 */
export async function getFrameDataUrl(assetsFetcher?: Fetcher): Promise<string> {
  let fetcher: Fetcher | undefined = assetsFetcher;

  // Resolve ASSETS binding from Cloudflare context if not provided
  if (!fetcher) {
    try {
      const { env } = await getCloudflareContext({ async: true });
      fetcher = (env as Cloudflare.Env | Record<string, unknown>).ASSETS as Fetcher | undefined;
    } catch (error) {
      throw new Error(`Failed to resolve ASSETS binding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!fetcher) {
    throw new Error("ASSETS binding is not available");
  }

  // Use ASSETS fetcher to get static asset directly (avoids circular fetch)
  const response = await fetcher.fetch("/frame.webp");

  if (!response.ok) {
    throw new Error(`Failed to fetch frame: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return arrayBufferToDataUrl(buffer, "image/webp");
}

/**
 * Fetch latest artwork from R2 and convert to data URL
 * Exported for testing
 *
 * @param baseUrl - Optional base URL for testing (uses env-based URL if not provided)
 */
const R2_ROUTE_PREFIX = "/api/r2/";

const decodeR2Key = (value: string): string | null => {
  if (!value) return null;

  let path = value;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const parsed = new URL(value);
      path = parsed.pathname;
    } catch {
      return null;
    }
  }

  if (!path.startsWith(R2_ROUTE_PREFIX)) return null;

  const encoded = path.slice(R2_ROUTE_PREFIX.length);
  if (!encoded) return null;

  return encoded
    .split("/")
    .map(segment => decodeURIComponent(segment))
    .join("/");
};

export async function getArtworkDataUrl(
  assetsFetcher?: Fetcher,
  bucketOverride?: R2Bucket,
): Promise<{ dataUrl: string; fallbackUsed: boolean }> {
  const fallback = async () => {
    const placeholderDataUrl = await getPlaceholderDataUrl(assetsFetcher);
    return { dataUrl: placeholderDataUrl, fallbackUsed: true };
  };

  let bucket: R2Bucket;
  if (bucketOverride) {
    bucket = bucketOverride;
  } else {
    const bucketResult = await resolveR2BucketAsync();
    if (bucketResult.isErr()) {
      logger.warn("ogp.bucket-resolution-failed", {
        error: bucketResult.error.message,
      });
      return fallback();
    }
    bucket = bucketResult.value;
  }

  const stateResult = await getJsonR2<GlobalState>(bucket, "state/global.json");

  if (stateResult.isErr()) {
    logger.warn("ogp.state-fetch-failed", {
      error: stateResult.error.message,
    });
    return fallback();
  }

  const state = stateResult.value;
  if (!state || !state.imageUrl) {
    logger.warn("ogp.state-no-image-url", { state });
    return fallback();
  }

  const imageKey = decodeR2Key(state.imageUrl);
  if (!imageKey) {
    logger.warn("ogp.state-invalid-image-url", { imageUrl: state.imageUrl });
    return fallback();
  }

  const imageResult = await getImageR2(bucket, imageKey);
  if (imageResult.isErr() || !imageResult.value) {
    logger.warn("ogp.image-fetch-failed", {
      key: imageKey,
      error: imageResult.isErr() ? imageResult.error.message : "Image not found",
    });
    return fallback();
  }

  const dataUrl = arrayBufferToDataUrl(imageResult.value, "image/webp");
  return { dataUrl, fallbackUsed: false };
}

/**
 * Generate OGP image using ImageResponse
 */
export default async function Image(): Promise<ImageResponse> {
  const startTime = Date.now();

  // Resolve ASSETS fetcher once for reuse
  let assetsFetcher: Fetcher | undefined;
  try {
    const { env } = await getCloudflareContext({ async: true });
    assetsFetcher = (env as Cloudflare.Env | Record<string, unknown>).ASSETS as Fetcher | undefined;
  } catch (error) {
    logger.warn("ogp.assets-resolution-failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const { dataUrl, fallbackUsed } = await getArtworkDataUrl(assetsFetcher);
    let frameDataUrl: string | null = null;
    try {
      frameDataUrl = await getFrameDataUrl(assetsFetcher);
    } catch (frameError) {
      logger.warn("ogp.frame-fetch-failed", {
        error: frameError instanceof Error ? frameError.message : String(frameError),
      });
    }

    logger.info("ogp.generated", {
      route: "/opengraph-image",
      fallbackUsed,
      hasFrame: frameDataUrl !== null,
      durationMs: Date.now() - startTime,
    });

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            backgroundColor: "#000000",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* Artwork image (centered, behind frame) */}
          <img
            src={dataUrl}
            style={{
              position: "absolute",
              height: "100%",
              width: "auto",
              objectFit: "contain",
            }}
            alt={alt}
          />
          {/* Frame overlay (on top) - only if available */}
          {frameDataUrl && (
            <img
              src={frameDataUrl}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              alt="Frame"
            />
          )}
        </div>
      ),
      {
        ...size,
        headers: {
          "Cache-Control": fallbackUsed ? "public, max-age=300" : "public, max-age=60, stale-while-revalidate=30",
        },
      },
    );
  } catch (error) {
    logger.error("ogp.error", {
      route: "/opengraph-image",
      error: error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) },
      durationMs: Date.now() - startTime,
    });

    try {
      const placeholderDataUrl = await getPlaceholderDataUrl(assetsFetcher);

      let frameDataUrl: string | null = null;
      try {
        frameDataUrl = await getFrameDataUrl(assetsFetcher);
      } catch (frameError) {
        logger.warn("ogp.frame-fetch-failed", {
          error: frameError instanceof Error ? frameError.message : String(frameError),
        });
      }

      logger.info("ogp.generated", {
        route: "/opengraph-image",
        fallbackUsed: true,
        hasFrame: frameDataUrl !== null,
        durationMs: Date.now() - startTime,
        fallbackLevel: "placeholder",
      });

      return new ImageResponse(
        (
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "100%",
              backgroundColor: "#000000",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <img
              src={placeholderDataUrl}
              style={{
                position: "absolute",
                height: "100%",
                width: "auto",
                objectFit: "contain",
              }}
              alt={alt}
            />
            {frameDataUrl && (
              <img
                src={frameDataUrl}
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                alt="Frame"
              />
            )}
          </div>
        ),
        {
          ...size,
          headers: {
            "Cache-Control": "public, max-age=300",
          },
        },
      );
    } catch (placeholderError) {
      logger.error("ogp.placeholder-fetch-failed", {
        route: "/opengraph-image",
        error:
          placeholderError instanceof Error
            ? { message: placeholderError.message, stack: placeholderError.stack }
            : { message: String(placeholderError) },
        durationMs: Date.now() - startTime,
      });

      return new ImageResponse(
        (
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
        ),
        {
          ...size,
          headers: { "Cache-Control": "public, max-age=60" },
        },
      );
    }
  }
}
