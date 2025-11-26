import type { AppRouter } from "@/server/trpc/routers/_app";
import { getBaseUrl } from "@/utils/url";
import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";

type CreateVanillaTRPCClientOptions = {
  baseUrl?: string;
};

/**
 * Create a vanilla tRPC client for use in Web Workers or other non-React contexts
 */
export function createVanillaTRPCClient(options: CreateVanillaTRPCClientOptions = {}) {
  const baseUrl = options.baseUrl ?? getBaseUrl();

  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: op => op.type === "subscription",
        true: httpSubscriptionLink({
          url: `${baseUrl}/api/trpc`,
        }),
        false: httpBatchLink({
          url: `${baseUrl}/api/trpc`,
          headers() {
            return {
              "content-type": "application/json",
            };
          },
          maxURLLength: 2083,
        }),
      }),
    ],
  });
}
