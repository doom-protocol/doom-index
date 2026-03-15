import handler from "vinext/server/app-router-entry";
import { handleScheduledEvent } from "@/cron";

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response> {
    return handler.fetch(request, env, ctx);
  },
  scheduled: handleScheduledEvent,
};
