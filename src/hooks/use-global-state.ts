import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { z } from "zod";
import type { GlobalState } from "@/types/domain";
import { logger } from "@/utils/logger";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Zod schema for GlobalState validation
 * Mirrors the GlobalState type definition
 */
const globalStateSchema = z.object({
  prevHash: z.string().nullable(),
  lastTs: z.string().nullable(),
  imageUrl: z.string().nullable().optional(),
  revenueMinute: z.string().nullable().optional(),
});

export const useGlobalState = () => {
  const previousImageUrlRef = useRef<string | null | undefined>(undefined);
  const trpc = useTRPC();

  const queryResult = useQuery({
    ...trpc.r2.getJson.queryOptions(
      { key: ["state", "global.json"] },
      {
        staleTime: 0, // Always consider data stale to allow refetchInterval to work
        refetchInterval: 60000, // Refetch every minute
        retry: 5,
      },
    ),
    select: (data: unknown): GlobalState | null => {
      if (data === null || data === undefined) {
        return null;
      }
      const parseResult = globalStateSchema.safeParse(data);
      if (parseResult.success) {
        return parseResult.data;
      }
      logger.error("use-global-state.validationFailed", {
        error: parseResult.error.message,
        data,
      });
      return null;
    },
  });

  // log data updates
  useEffect(() => {
    const currentImageUrl = queryResult.data?.imageUrl;

    // skip on initial render
    if (previousImageUrlRef.current === undefined) {
      previousImageUrlRef.current = currentImageUrl;
      return;
    }

    // log only when imageUrl changes
    if (previousImageUrlRef.current !== currentImageUrl) {
      logger.debug("use-global-state.dataUpdated", {
        previousImageUrl: previousImageUrlRef.current ?? null,
        currentImageUrl: currentImageUrl ?? null,
        lastTs: queryResult.data?.lastTs ?? null,
      });
      previousImageUrlRef.current = currentImageUrl;
    }
  }, [queryResult.data]);

  return queryResult;
};

// helper function to refetch the global state immediately
// ignore staleTime and refetch immediately
export const useGlobalStateRefetch = () => {
  const { refetch } = useGlobalState();

  return async () => {
    logger.debug("use-global-state.refetch.triggered");
    const result = await refetch({ cancelRefetch: false });
    logger.debug("use-global-state.refetch.completed", {
      success: result.isSuccess,
      imageUrl: result.data?.imageUrl ?? null,
    });
    return result;
  };
};
