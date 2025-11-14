import { useQuery } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "@/lib/trpc/client";
import type { ArchiveListResponse } from "@/services/archive-list";
import { logger } from "@/utils/logger";

interface UseArchiveOptions {
  limit?: number;
  cursor?: string;
  startDate?: string;
  endDate?: string;
}

export const useArchive = (options: UseArchiveOptions = {}) => {
  const { limit = 20, cursor, startDate, endDate } = options;

  const trpc = useTRPC();
  const client = useTRPCClient();

  // Ensure cursor is included in queryKey even if undefined
  const queryKey = trpc.archive.list.queryKey({
    limit,
    cursor: cursor ?? undefined, // Explicitly pass undefined
    startDate: startDate ?? undefined,
    endDate: endDate ?? undefined,
  });

  logger.debug("use-archive.query-key", {
    limit,
    cursor: cursor || "undefined",
    startDate: startDate || "none",
    endDate: endDate || "none",
    queryKey: JSON.stringify(queryKey),
  });

  return useQuery({
    queryKey,
    queryFn: async (): Promise<ArchiveListResponse> => {
      logger.debug("use-archive.query-fn", {
        limit,
        cursor: cursor || "undefined",
        startDate: startDate || "none",
        endDate: endDate || "none",
      });

      const result = await client.archive.list.query({
        limit,
        cursor,
        startDate,
        endDate,
      });

      const typedResult = result as ArchiveListResponse;
      logger.debug("use-archive.fetch-result", {
        itemsCount: typedResult.items.length,
        hasMore: typedResult.hasMore,
        limit,
        requestedCursor: cursor || "none",
        returnedCursor: typedResult.cursor || "none",
        firstItemId: typedResult.items[0]?.id || "none",
        lastItemId: typedResult.items[typedResult.items.length - 1]?.id || "none",
      });

      return typedResult;
    },
    staleTime: 0, // Always refetch to ensure correct cursor
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
