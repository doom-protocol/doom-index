import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { getBaseUrl } from "@/utils/url";

/**
 * Create a vanilla tRPC client for use in Web Workers or other non-React contexts
 */
export function createVanillaTRPCClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        async headers() {
          return {
            "content-type": "application/json",
          };
        },
        maxURLLength: 2083,
      }),
    ],
  });
}
