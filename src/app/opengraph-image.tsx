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
import { getJsonFromPublicUrl, getImageFromPublicUrl } from "@/lib/r2";
import { logger } from "@/utils/logger";
import { arrayBufferToDataUrl } from "@/utils/image";
import { env } from "@/env";
import type { GlobalState } from "@/types/domain";

// Route Segment Config for ISR
export const revalidate = 60; // Regenerate every 60 seconds
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "DOOM INDEX - Current world state visualization";

/**
 * Fetch placeholder image and convert to data URL
 * Exported for testing
 */
export async function getPlaceholderDataUrl(r2Domain: string): Promise<string> {
  const placeholderUrl = new URL("/placeholder-painting.webp", r2Domain);
  const response = await fetch(placeholderUrl.toString());

  if (!response.ok) {
    throw new Error(`Failed to fetch placeholder: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return arrayBufferToDataUrl(buffer, "image/webp");
}

/**
 * Fetch latest artwork from R2 and convert to data URL
 * Exported for testing
 */
export async function getArtworkDataUrl(r2Domain: string): Promise<{ dataUrl: string; fallbackUsed: boolean }> {
  const stateUrl = `${r2Domain}/state/global.json`;
  const stateResult = await getJsonFromPublicUrl<GlobalState>(stateUrl);

  if (stateResult.isErr()) {
    logger.warn("ogp.state-fetch-failed", {
      url: stateUrl,
      error: stateResult.error.message,
    });
    const placeholderDataUrl = await getPlaceholderDataUrl(r2Domain);
    return { dataUrl: placeholderDataUrl, fallbackUsed: true };
  }

  const state = stateResult.value;
  if (!state || !state.imageUrl) {
    logger.warn("ogp.state-no-image-url", { state });
    const placeholderDataUrl = await getPlaceholderDataUrl(r2Domain);
    return { dataUrl: placeholderDataUrl, fallbackUsed: true };
  }

  const imageResult = await getImageFromPublicUrl(state.imageUrl);
  if (imageResult.isErr() || !imageResult.value) {
    logger.warn("ogp.image-fetch-failed", {
      url: state.imageUrl,
      error: imageResult.isErr() ? imageResult.error.message : "Image not found",
    });
    const placeholderDataUrl = await getPlaceholderDataUrl(r2Domain);
    return { dataUrl: placeholderDataUrl, fallbackUsed: true };
  }

  const dataUrl = arrayBufferToDataUrl(imageResult.value, "image/webp");
  return { dataUrl, fallbackUsed: false };
}

/**
 * Generate OGP image using ImageResponse
 */
export default async function Image(): Promise<ImageResponse> {
  const startTime = Date.now();

  try {
    const { dataUrl, fallbackUsed } = await getArtworkDataUrl(env.R2_PUBLIC_DOMAIN);

    logger.info("ogp.generated", {
      route: "/opengraph-image",
      fallbackUsed,
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
          }}
        >
          <img
            src={dataUrl}
            style={{
              height: "100%",
              width: "auto",
              objectFit: "contain",
            }}
            alt={alt}
          />
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
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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
