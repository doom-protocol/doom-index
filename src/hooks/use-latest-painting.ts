import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { ArchiveListResponse } from "@/services/paintings";
import type { PaintingMetadata } from "@/types/paintings";
import { logger } from "@/utils/logger";
import { useTRPCClient } from "@/lib/trpc/client";

// 1 hour in milliseconds
const REFETCH_INTERVAL = 3600000;

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
    refetchInterval: REFETCH_INTERVAL,
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
  const { refetch } = useLatestPainting();

  return async () => {
    logger.debug("use-latest-painting.refetch.triggered");
    const result = await refetch({ cancelRefetch: false });
    logger.debug("use-latest-painting.refetch.completed", {
      success: result.isSuccess,
      paintingId: result.data?.id ?? "none",
    });
    return result;
  };
};
