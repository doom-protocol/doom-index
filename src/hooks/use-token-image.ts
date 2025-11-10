import { useQuery } from "@tanstack/react-query";
import type { TokenTicker } from "@/types/domain";

interface TokenImageResponse {
  thumbnailUrl: string;
  updatedAt: string;
}

const fetchTokenImage = async (ticker: TokenTicker): Promise<TokenImageResponse | null> => {
  const response = await fetch(`/api/tokens/${ticker}`);

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch token image: ${response.status}`);
  }

  return response.json();
};

export const useTokenImage = (ticker: TokenTicker) => {
  return useQuery<TokenImageResponse | null, Error>({
    queryKey: ["token-image", ticker],
    queryFn: () => fetchTokenImage(ticker),
    gcTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
