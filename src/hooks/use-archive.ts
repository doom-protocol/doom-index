import { useTRPC, useTRPCClient } from "@/lib/trpc/client";
import type { ArchiveListResponse } from "@/services/paintings";
import type { PaginationOptions } from "@/types/domain";
import { logger } from "@/utils/logger";
import { useQuery } from "@tanstack/react-query";

interface UseArchiveOptions extends PaginationOptions {
  enabled?: boolean;
}

export const useArchive = (options: UseArchiveOptions = {}) => {
  const { limit = 20, cursor, from, to, enabled = true } = options;

  const trpc = useTRPC();
  const client = useTRPCClient();

  // Ensure cursor is included in queryKey even if undefined
  const queryKey = trpc.paintings.list.queryKey({
    limit,
    cursor: cursor ?? undefined, // Explicitly pass undefined
    from: from ?? undefined,
    to: to ?? undefined,
  });

  logger.debug("use-paintings.query-key", {
    limit,
    cursor: cursor || "undefined",
    from: from || "none",
    to: to || "none",
    queryKey: JSON.stringify(queryKey),
  });

  return useQuery({
    queryKey,
    queryFn: async (): Promise<ArchiveListResponse> => {
      logger.debug("use-paintings.query-fn", {
        limit,
        cursor: cursor || "undefined",
        from: from || "none",
        to: to || "none",
      });

      const result = await client.paintings.list.query({
        limit,
        cursor,
        from,
        to,
      });

      const typedResult = result as ArchiveListResponse;
      logger.debug("use-paintings.fetch-result", {
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
    enabled,
    staleTime: 0, // Always refetch to ensure correct cursor
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
