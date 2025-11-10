/**
 * Cloudflare Workers Entry Point
 *
 * Unified entry point for Next.js server-side rendering (SSR)
 * and Cron Triggers event handling.
 */

import nextHandler from "../.open-next/worker.js";
import { handleScheduledEvent } from "./cron";

const worker = {
  fetch: nextHandler.fetch,
  scheduled: handleScheduledEvent,
};

export default worker;
