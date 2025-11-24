import { env } from "@/env";
import { err, ok, Result } from "neverthrow";

type SlackMessage = {
  text?: string;
  blocks?: unknown[];
  attachments?: unknown[];
};

type SlackError = {
  type: "network" | "config";
  message: string;
};

/**
 * Send a message to Slack using the configured webhook URL.
 *
 * @param message - The message payload to send
 * @returns Result indicating success or failure
 */
export async function sendSlackMessage(message: SlackMessage): Promise<Result<void, SlackError>> {
  const webhookUrl = env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return err({
      type: "config",
      message: "SLACK_WEBHOOK_URL is not configured",
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      return err({
        type: "network",
        message: `Failed to send message to Slack: ${response.status} ${response.statusText}`,
      });
    }

    return ok(undefined);
  } catch (error) {
    return err({
      type: "network",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Helper to extract file location from stack trace
 */
function getSourceFromStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  const lines = stack.split("\n");
  // First line is usually the error message, second line is the first stack frame
  // But sometimes the stack starts directly with frames (depending on browser/env)
  // We look for lines starting with "at " or containing specific patterns
  const firstFrame = lines.find(line => line.trim().startsWith("at ") || line.includes(":"));
  return firstFrame ? firstFrame.trim() : undefined;
}

/**
 * Format an error object for Slack reporting.
 *
 * @param error - The error to report
 * @param context - Additional context about where the error occurred (e.g. log message)
 * @returns Slack message payload
 */
export function formatErrorForSlack(error: unknown, context?: string): SlackMessage {
  let errorMessage: string;
  let stackTrace: string | undefined;
  let additionalDetails: string | undefined;

  // Resolve error object
  if (error instanceof Error) {
    errorMessage = error.message;
    stackTrace = error.stack;
  } else if (typeof error === "object" && error !== null) {
    // Handle object wrappers
    if ("error" in error && (error as { error: Error }).error instanceof Error) {
      const inner = (error as { error: Error }).error;
      errorMessage = inner.message;
      stackTrace = inner.stack;
      // Stringify the wrapper to show other context
      try {
        const wrapperCopy = { ...error, error: "[Error Object]" };
        additionalDetails = JSON.stringify(wrapperCopy, null, 2);
      } catch {}
    } else if ("stack" in error) {
      // Error-like object
      errorMessage = (error as { message?: string }).message || String(error);
      stackTrace = (error as { stack?: string }).stack;
      try {
        additionalDetails = JSON.stringify(error, null, 2);
      } catch {}
    } else {
      // Generic object
      try {
        errorMessage = JSON.stringify(error, null, 2);
      } catch {
        errorMessage = String(error);
      }
    }
  } else {
    errorMessage = String(error);
  }

  const source = getSourceFromStack(stackTrace);

  // Build a simple text message to avoid Block Kit issues
  let message = `🚨 Server Error\n\n`;
  message += `*Environment:* ${env.NODE_ENV}\n`;
  message += `*Context:* ${context || "N/A"}\n`;

  if (source) {
    message += `*Source:* \`${source}\`\n`;
  }

  message += `*Message:* ${errorMessage}\n`;

  if (additionalDetails) {
    const truncatedDetails = additionalDetails.length > 1000
      ? additionalDetails.substring(0, 1000) + "...(truncated)"
      : additionalDetails;
    message += `*Details:* \`\`\`${truncatedDetails}\`\`\`\n`;
  }

  if (stackTrace) {
    const truncatedStack = stackTrace.length > 2000
      ? stackTrace.substring(0, 2000) + "\n...(truncated)"
      : stackTrace;
    message += `*Stack Trace:* \`\`\`${truncatedStack}\`\`\`\n`;
  }

  return {
    text: `Server Error: ${context || errorMessage}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: message,
        },
      },
    ],
  };
}
