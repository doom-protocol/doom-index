/**
 * Cloudflare Workers Entry Point
 *
 * Unified entry point for Next.js server-side rendering (SSR)
 * and Cron Triggers event handling.
 */

import nextHandler from "../.open-next/worker.js";
import { handleScheduledEvent } from "./cron";

type OpenNextWorkerEnv = Cloudflare.Env & Record<string, unknown>;

function isOpenNextHandler(value: unknown): value is {
  fetch: (request: Request, env: OpenNextWorkerEnv, ctx: ExecutionContext) => Promise<Response>;
} {
  return typeof value === "object" && value !== null && "fetch" in value && typeof value.fetch === "function";
}

if (!isOpenNextHandler(nextHandler)) {
  throw new TypeError("OpenNext worker does not expose a fetch handler");
}

const worker: ExportedHandler<OpenNextWorkerEnv> = {
  fetch: nextHandler.fetch,
  scheduled: handleScheduledEvent,
};

export default worker;
