import "server-only"; // <-- ensure this file cannot be imported from the client

import { appRouter } from "./routers/_app";
import { createServerContext, createStaticServerContext } from "./context";
import { createCallerFactory } from "./trpc";

const createCaller = createCallerFactory(appRouter);

/**
 * Create a tRPC caller for use in Server Components.
 * This allows direct server-side data fetching without HTTP round-trips.
 */
export async function createServerCaller() {
  const ctx = await createServerContext();
  return createCaller(ctx);
}

export async function createStaticServerCaller() {
  const ctx = await createStaticServerContext();
  return createCaller(ctx);
}
