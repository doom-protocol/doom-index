/**
 * Cloudflare Workers Entry Point
 *
 * Unified entry point for Next.js server-side rendering (SSR)
 * and Cron Triggers event handling.
 */

import nextHandler from "../.open-next/worker.js";
import { handleScheduledEvent } from "./cron";

const worker: ExportedHandler<Cloudflare.Env> = {
  fetch: async (...args: Parameters<ExportedHandlerFetchHandler<Cloudflare.Env>>) =>
    (nextHandler.fetch as ExportedHandlerFetchHandler<Cloudflare.Env>)(...args),
  scheduled: handleScheduledEvent,
};

export default worker;
