"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useViewer } from "@/hooks/use-viewer";
import { useState } from "react";
import { TRPCProvider, createTRPCClientInstance } from "@/lib/trpc/client";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useViewer(); // start viewer worker
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() => createTRPCClientInstance());

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
};
