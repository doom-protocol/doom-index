import { reportError } from "@/lib/error-reporter";
import { createContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/routers/_app";
import { logger } from "@/utils/logger";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

// Cloudflare Workers runs this route on the edge by default, so we do not need
// a separate runtime export here.

const handler = async (req: Request): Promise<Response> => {
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
        void reportError(error, `TRPC Internal Error at ${String(path)}`);
      }
    },
  });

  // If the procedure returns a Response object, pass it through
  // This allows streaming binary data directly when procedures need it.
  return response;
};

export { handler as GET, handler as POST };
