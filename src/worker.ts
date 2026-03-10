/**
 * Cloudflare Workers Entry Point
 *
 * Unified entry point for Next.js server-side rendering (SSR)
 * and Cron Triggers event handling.
 */

import nextHandler from "../.open-next/worker.js";
import { handleScheduledEvent } from "./cron";

type OpenNextWorkerEnv = Cloudflare.Env & Record<string, unknown>;

const worker: ExportedHandler<OpenNextWorkerEnv> = {
  fetch: async (request, env, ctx): Promise<Response> => nextHandler.fetch(request, env, ctx) as Promise<Response>,
  scheduled: handleScheduledEvent,
};

export default worker;
