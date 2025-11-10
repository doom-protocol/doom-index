import { useQuery } from "@tanstack/react-query";
import type { McMap } from "@/types/domain";

interface McResponse {
  tokens: McMap;
  generatedAt: string;
}

const FALLBACK_MC: McMap = {
  CO2: 0,
  ICE: 0,
  FOREST: 0,
  NUKE: 0,
  MACHINE: 0,
  PANDEMIC: 0,
  FEAR: 0,
  HOPE: 0,
};

const fetchMc = async (): Promise<McResponse> => {
  const response = await fetch("/api/mc");

  if (!response.ok) {
    throw new Error(`Failed to fetch MC: ${response.status}`);
  }

  return response.json();
};

export const useMc = () => {
  return useQuery<McResponse, Error>({
    queryKey: ["mc"],
    queryFn: fetchMc,
    refetchInterval: 10000,
    staleTime: 10000,
    retry: 1,
    placeholderData: {
      tokens: FALLBACK_MC,
      generatedAt: new Date().toISOString(),
    },
  });
};
