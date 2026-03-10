import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

export const useTokenImage = (ticker: string): UseQueryResult<unknown, unknown> => {
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
