import { useTRPC } from "@/lib/trpc/client";
import type { TokenTicker } from "@/types/domain";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

export const useTokenImage = (ticker: TokenTicker): UseQueryResult<unknown, unknown> => {
  const trpc = useTRPC();
  return useQuery(
    trpc.token.getState.queryOptions(
      { ticker },
      {
        staleTime: 60000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    ),
  );
};
