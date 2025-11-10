/**
 * Cloudflare Workers Entry Point
 *
 * Unified entry point for Next.js server-side rendering (SSR)
 * and Cron Triggers event handling.
 */

import { default as handler } from "../.open-next/worker.js";
import { handleScheduledEvent } from "./cron";

const worker = {
  fetch: handler.fetch,
  scheduled: handleScheduledEvent,
};

export default worker;
