"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useViewer } from "@/hooks/use-viewer";
import { useState } from "react";

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useViewer(); // start viewer worker
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
