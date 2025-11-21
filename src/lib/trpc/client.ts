import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { getBaseUrl } from "@/utils/url";

// Create tRPC Context Provider and Hooks
export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

// tRPC client creation function
export function createTRPCClientInstance() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,

        // Custom headers
        async headers() {
          return {
            // Add authentication headers as needed
          };
        },

        // Batch settings
        maxURLLength: 2083,
      }),
    ],
  });
}
