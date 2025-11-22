import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/routers/_app";
import { createContext } from "@/server/trpc/context";
import { logger } from "@/utils/logger";
import { reportError } from "@/lib/error-reporter";

// Note: OpenNext Cloudflare requires edge runtime functions to be defined separately.
// Since Cloudflare Workers run on edge runtime by default, we don't need to explicitly
// set runtime = "edge" here. The function will be bundled correctly by OpenNext.

const handler = async (req: Request) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      logger.error("trpc.api.error", {
        path,
        error: {
          code: error.code,
          message: error.message,
          cause: error.cause,
        },
      });

      // Only report internal server errors to Slack
      if (error.code === "INTERNAL_SERVER_ERROR") {
        reportError(error, `TRPC Internal Error at ${path}`);
      }
    },
  });

  // If the procedure returns a Response object, pass it through
  // This allows streaming binary data (e.g., R2 objects) directly
  return response;
};

export { handler as GET, handler as POST };
