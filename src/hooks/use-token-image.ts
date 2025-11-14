import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import type { TokenTicker } from "@/types/domain";

export const useTokenImage = (ticker: TokenTicker) => {
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
