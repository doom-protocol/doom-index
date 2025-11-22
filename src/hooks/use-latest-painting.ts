import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { ArchiveListResponse } from "@/services/paintings";
import type { PaintingMetadata } from "@/types/paintings";
import { logger } from "@/utils/logger";
import { useTRPCClient } from "@/lib/trpc/client";

import { GENERATION_INTERVAL_MS } from "@/constants";

const MIN_REFETCH_INTERVAL_MS = 30_000;
const STALE_POLL_INTERVAL_MS = 60_000;
const POST_GENERATION_DELAY_MS = 15_000;

const clampInterval = (value: number): number => Math.max(MIN_REFETCH_INTERVAL_MS, value);

const computeRefetchDelay = (lastTimestamp?: string | null): number => {
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
      try {
        // Fetch the latest painting (limit: 1)
        const result = (await client.paintings.list.query({
          limit: 1,
        })) as ArchiveListResponse;

        if (!result.items || result.items.length === 0) {
          logger.debug("use-latest-painting.no-paintings");
          return null;
        }

        return result.items[0];
      } catch (error) {
        logger.error("use-latest-painting.fetch-failed", {
          error: error instanceof Error ? error.message : String(error),
        });
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
