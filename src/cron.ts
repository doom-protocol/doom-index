/**
 * Cloudflare Workers Cron Handler
 *
 * Logic for Cron Triggers executed every minute.
 * Calls GenerationService.runMinuteGeneration() to perform
 * image generation and state updates.
 */

import { createServicesForWorkers } from "./services/container";

// R2 public domain configured based on environment
const R2_PUBLIC_DOMAIN = "https://doom-index-storage.r2.dev";

/**
 * Processing logic for Cron execution
 */
export async function handleScheduledEvent(
  event: ScheduledEvent,
  env: Cloudflare.Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const startTime = Date.now();

  console.info("Cron triggered", {
    scheduledTime: new Date(event.scheduledTime).toISOString(),
    cron: event.cron,
  });

  try {
    // Create service container
    const services = createServicesForWorkers(env.R2_BUCKET, R2_PUBLIC_DOMAIN);

    // Execute image generation
    const result = await services.generationService.evaluateMinute();

    if (result.isErr()) {
      console.error("Generation failed", {
        error: result.error,
        durationMs: Date.now() - startTime,
      });
      return;
    }

    const { status, hash, imageUrl } = result.value;

    console.info("Cron success", {
      status,
      hash,
      imageUrl,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    console.error("Cron failed", {
      error: message,
      stack,
      durationMs: Date.now() - startTime,
    });
  }
}
