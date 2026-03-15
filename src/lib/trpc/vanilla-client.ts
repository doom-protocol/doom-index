import type { AppRouter } from "@/server/trpc/routers/_app";
import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import type { TRPCClient } from "@trpc/client";

interface CreateVanillaTRPCClientOptions {
  baseUrl?: string;
}

function getWorkerSafeBaseUrl(baseUrl?: string): string {
  if (baseUrl) {
    return baseUrl;
  }

  if (typeof self !== "undefined" && "location" in self) {
    return self.location.origin;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:8787";
}

/**
 * Create a vanilla tRPC client for use in Web Workers or other non-React contexts
 */
export function createVanillaTRPCClient(options: CreateVanillaTRPCClientOptions = {}): TRPCClient<AppRouter> {
  const baseUrl = getWorkerSafeBaseUrl(options.baseUrl);

  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => op.type === "subscription",
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
