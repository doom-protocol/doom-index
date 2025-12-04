"use server";

import { formatErrorForSlack, sendSlackMessage } from "@/lib/slack-client";
import { logger } from "@/utils/logger";

export async function reportGlobalError(error: {
  digest?: string;
  message: string;
  stack?: string;
  name?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Add digest to context if available
    const context = error.digest ? `Digest: ${error.digest}` : "Client-side Global Error";

    const slackMessage = formatErrorForSlack(
      {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      context,
    );

    const result = await sendSlackMessage(slackMessage);

    if (result.isErr()) {
      logger.error("actions.report-error.failed", { error: result.error });
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (e) {
    logger.error("actions.report-error.exception", { error: e });
    return { success: false, error: "Internal Server Error" };
  }
}
