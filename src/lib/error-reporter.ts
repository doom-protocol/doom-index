import { logger } from "@/utils/logger";
import { formatErrorForSlack, sendSlackMessage } from "./slack-client";

/**
 * Report an error to external monitoring services (Slack).
 * This function should be used for critical errors that require developer attention.
 *
 * @param error - The error object or message
 * @param context - Additional context describing where/why the error occurred
 */
export async function reportError(error: unknown, context?: string): Promise<void> {
  // Always log locally first
  // We don't use logger.error here to avoid potential infinite loops if we were to hook into it,
  // but mainly to keep concerns separate.

  try {
    const message = formatErrorForSlack(error, context);
    const result = await sendSlackMessage(message);

    if (result.isErr()) {
      // Fallback log if reporting fails
      logger.error("Failed to report error to Slack:", result.error);
    }
  } catch (e) {
    logger.error("Exception during error reporting:", e);
  }
}
