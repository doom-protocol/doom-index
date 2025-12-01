import { useTRPCClient } from "@/lib/trpc/client";
import type { ArchiveListResponse } from "@/services/paintings";
import type { PaintingMetadata } from "@/types/paintings";
import { logger } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { GENERATION_INTERVAL_MS } from "@/constants";

export const MIN_REFETCH_INTERVAL_MS = 30_000;
export const STALE_POLL_INTERVAL_MS = 60_000;
export const POST_GENERATION_DELAY_MS = 15_000;

export const clampInterval = (value: number): number => Math.max(MIN_REFETCH_INTERVAL_MS, value);

export const computeRefetchDelay = (lastTimestamp?: string | null): number => {
  if (!GENERATION_INTERVAL_MS || GENERATION_INTERVAL_MS <= 0) {
    return STALE_POLL_INTERVAL_MS;
  }

  if (!lastTimestamp) {
    return MIN_REFETCH_INTERVAL_MS;
  }

  const lastUpdated = Date.parse(lastTimestamp);
  if (!Number.isFinite(lastUpdated)) {
    return STALE_POLL_INTERVAL_MS;
  }

  const now = Date.now();
  const age = now - lastUpdated;

  if (age >= GENERATION_INTERVAL_MS) {
    return clampInterval(STALE_POLL_INTERVAL_MS);
  }

  const elapsedInWindow = now % GENERATION_INTERVAL_MS;
  const msUntilNextBoundary = GENERATION_INTERVAL_MS - elapsedInWindow;
  const delay = msUntilNextBoundary + POST_GENERATION_DELAY_MS;

  return clampInterval(delay);
};

/**
 * Result of fetching the latest painting
 */
export interface FetchLatestPaintingResult {
  painting: PaintingMetadata | null;
  durationMs: number;
}

/**
 * Pure function to fetch the latest painting from the API.
 * Extracted for testability - allows measuring fetch duration without React hooks.
 *
 * @param queryFn - Function that performs the actual API call
 * @param now - Optional function to get current time (for testing)
 * @returns Promise with painting data and duration in milliseconds
 */
export async function fetchLatestPainting(
  queryFn: () => Promise<ArchiveListResponse>,
  now: () => number = performance.now,
): Promise<FetchLatestPaintingResult> {
  const start = now();
  logger.debug("use-latest-painting.fetch.start");

  const result = await queryFn();
  const durationMs = now() - start;

  if (!result.items || result.items.length === 0) {
    logger.debug("use-latest-painting.no-paintings", { durationMs });
    return { painting: null, durationMs };
  }

  logger.debug("use-latest-painting.fetch.success", {
    durationMs,
    paintingId: result.items[0]?.id,
  });

  return { painting: result.items[0], durationMs };
}

/**
 * Hook to fetch the latest painting
 * This replaces the legacy "GlobalState" concept.
 *
 * It fetches the most recent painting from the archive
 * and refreshes periodically to match the cron generation schedule.
 */
export const useLatestPainting = () => {
  const previousImageUrlRef = useRef<string | null | undefined>(undefined);
  const client = useTRPCClient();

  const queryResult = useQuery({
    queryKey: ["paintings", "latest"],
    queryFn: async (): Promise<PaintingMetadata | null> => {
      const start = performance.now();
      try {
        logger.debug("use-latest-painting.fetch.start");
        const result = (await client.paintings.list.query({
          limit: 1,
        })) as ArchiveListResponse;
        const durationMs = performance.now() - start;

        if (!result.items || result.items.length === 0) {
          logger.debug("use-latest-painting.no-paintings", { durationMs });
          return null;
        }

        logger.debug("use-latest-painting.fetch.success", {
          durationMs,
          paintingId: result.items[0]?.id,
        });
        return result.items[0];
      } catch (error) {
        logger.error("use-latest-painting.fetch-failed", {
          error: error instanceof Error ? error.message : String(error),
        });

        // Development fallback: Return a mock painting if tRPC fails
        if (process.env.NODE_ENV === "development") {
          logger.info("use-latest-painting.development-fallback");
          return {
            id: "mock-painting-1",
            timestamp: new Date().toISOString(),
            minuteBucket: "2025/11/27/14/30",
            paramsHash: "mock-hash",
            seed: "12345",
            imageUrl: "/placeholder-painting.webp",
            fileSize: 1024000,
            visualParams: {
              fogDensity: 0.5,
              skyTint: 0.3,
              reflectivity: 0.2,
              blueBalance: 0.1,
              vegetationDensity: 0.4,
              organicPattern: 0.3,
              radiationGlow: 0.1,
              debrisIntensity: 0.2,
              mechanicalPattern: 0.1,
              metallicRatio: 0.2,
              fractalDensity: 0.3,
              bioluminescence: 0.1,
              shadowDepth: 0.4,
              redHighlight: 0.1,
              lightIntensity: 0.8,
              warmHue: 0.2,
              tokenWeights: {
                fear: 0.2,
                hope: 0.3,
                machine: 0.1,
                ice: 0.1,
                forest: 0.1,
                co2: 0.1,
                pandemic: 0.05,
                nuke: 0.05,
              },
              worldPrompt: "A world on the brink of change...",
            },
            prompt: "Mock painting for development",
            negative: "",
          };
        }

        return null;
      }
    },
    staleTime: 0, // Always check for updates when the interval hits
    refetchInterval: query => {
      const latest = query.state.data;
      return computeRefetchDelay(latest?.timestamp ?? null);
    },
    refetchIntervalInBackground: true,
    retry: 3,
  });

  // Log when a new painting appears
  useEffect(() => {
    const currentImageUrl = queryResult.data?.imageUrl;

    // Skip on initial render
    if (previousImageUrlRef.current === undefined) {
      previousImageUrlRef.current = currentImageUrl;
      return;
    }

    // Log only when imageUrl changes (new painting generated)
    if (previousImageUrlRef.current !== currentImageUrl) {
      logger.info("use-latest-painting.new-painting-detected", {
        previousImageUrl: previousImageUrlRef.current ?? "none",
        currentImageUrl: currentImageUrl ?? "none",
        timestamp: queryResult.data?.timestamp,
      });
      previousImageUrlRef.current = currentImageUrl;
    }
  }, [queryResult.data]);

  return queryResult;
};

/**
 * Helper function to manually refresh the latest painting
 * Useful for UI components that need to force an update (e.g. after a progress bar completes)
 */
export const useLatestPaintingRefetch = () => {
  const queryClient = useQueryClient();

  return async () => {
    logger.debug("use-latest-painting.refetch.triggered");

    // Invalidate the query to trigger a refetch
    await queryClient.invalidateQueries({
      queryKey: ["paintings", "latest"],
    });

    // Wait for the query to refetch
    await queryClient.refetchQueries({
      queryKey: ["paintings", "latest"],
    });

    logger.debug("use-latest-painting.refetch.completed", {
      paintingId: "refetch-triggered",
    });

    // Return undefined to match the original interface (refetch doesn't return data)
    return undefined;
  };
};
