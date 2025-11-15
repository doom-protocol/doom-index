/**
 * Cloudflare Workers Cron Handler
 *
 * Logic for Cron Triggers executed every minute.
 * Calls GenerationService.runMinuteGeneration() to perform
 * image generation and state updates.
 */

import { createServicesForWorkers } from "./services/container";
// import { createViewerService } from "./services/viewer";
import { logger } from "./utils/logger";
import { getErrorMessage, getErrorStack } from "./utils/error";

/**
 * Processing logic for Cron execution
 */
export async function handleScheduledEvent(
  event: ScheduledEvent,
  env: Cloudflare.Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const startTime = Date.now();

  logger.debug("cron.triggered", {
    scheduledTime: new Date(event.scheduledTime).toISOString(),
    cron: event.cron,
  });

  try {
    // check if there is an active viewer
    // const kvNamespace = env.VIEWER_KV;
    // if (kvNamespace) {
    //   const viewerService = createViewerService({ kvNamespace });
    //   const viewerResult = await viewerService.hasActiveViewer();
    //
    //   if (viewerResult.isErr()) {
    //     logger.error("viewer.check.error", {
    //       error: viewerResult.error,
    //       durationMs: Date.now() - startTime,
    //     });
    //     // if an error occurs, continue with generation (fallback)
    //   } else if (!viewerResult.value) {
    //     // if there is no active viewer, skip generation
    //     logger.info("Cron skipped: no viewer", {
    //       durationMs: Date.now() - startTime,
    //     });
    //     return;
    //   }
    //   logger.debug("viewer.check.found", {
    //     durationMs: Date.now() - startTime,
    //   });
    // } else {
    //   logger.warn("viewer.check.skip", {
    //     message: "VIEWER_KV binding not configured, skipping viewer check",
    //   });
    // }

    // create service container
    const services = createServicesForWorkers(env.R2_BUCKET);

    // execute image generation
    const result = await services.generationService.evaluateMinute();

    if (result.isErr()) {
      logger.debug("cron.generation.failed", {
        error: result.error,
        durationMs: Date.now() - startTime,
      });
      return;
    }

    const { status, hash, imageUrl } = result.value;

    logger.debug("cron.success", {
      status,
      hash,
      imageUrl,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.debug("cron.failed", {
      error: getErrorMessage(error),
      stack: getErrorStack(error),
      durationMs: Date.now() - startTime,
    });
  }
}
