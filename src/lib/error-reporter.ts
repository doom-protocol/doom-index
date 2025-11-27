import { logger } from "@/utils/logger";
import { type ErrorSource, formatErrorForSlack, sendSlackMessage } from "./slack-client";

export type { ErrorSource };

type ReportErrorOptions = {
  context?: string;
  source?: ErrorSource;
};

/**
 * Report an error to external monitoring services (Slack).
 * This function should be used for critical errors that require developer attention.
 *
 * @param error - The error object or message
 * @param contextOrOptions - Additional context string OR options object with context and source
 */
export async function reportError(error: unknown, contextOrOptions?: string | ReportErrorOptions): Promise<void> {
  // Always log locally first
  // We don't use logger.error here to avoid potential infinite loops if we were to hook into it,
  // but mainly to keep concerns separate.

  const options = typeof contextOrOptions === "string" ? { context: contextOrOptions } : contextOrOptions;
  const { context, source = "server" } = options ?? {};

  try {
    const message = formatErrorForSlack(error, context, source);
    const result = await sendSlackMessage(message);

    if (result.isErr()) {
      // Fallback log if reporting fails
      logger.error("Failed to report error to Slack:", result.error);
    }
  } catch (e) {
    logger.error("Exception during error reporting:", e);
  }
}
