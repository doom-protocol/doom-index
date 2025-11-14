import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export const useMc = () => {
  const trpc = useTRPC();
  return useQuery(
    trpc.mc.getMarketCaps.queryOptions(undefined, {
      refetchInterval: 10000,
      staleTime: 10000,
      retry: 1,
    }),
  );
};
