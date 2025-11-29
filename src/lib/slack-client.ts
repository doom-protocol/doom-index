import { env } from "@/env";
import { err, ok, type Result } from "neverthrow";

type SlackAttachmentField = {
  title: string;
  value: string;
  short?: boolean;
};

type SlackAttachment = {
  fallback?: string;
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: SlackAttachmentField[];
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
  mrkdwn_in?: string[];
};

type SlackMessage = {
  text?: string;
  blocks?: unknown[];
  attachments?: SlackAttachment[];
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
  // Look for lines starting with "at " (V8/Node) or containing explicit file paths
  const stackFrame = lines.find(line => {
    const trimmed = line.trim();
    return trimmed.startsWith("at ") || (trimmed.includes("/") && trimmed.includes(":"));
  });
  return stackFrame ? stackFrame.trim() : undefined;
}

/**
 * Decode JSON-style escape sequences in a string.
 * Handles \n, \", \\, etc. by treating the string as JSON string content.
 * This works for strings that are already properly escaped (e.g., from JSON.stringify).
 */
function decodeJsonEscapes(str: string): string | null {
  if (!str.includes("\\")) {
    return null;
  }

  try {
    const wrapped = `"${str}"`;
    return JSON.parse(wrapped);
  } catch {
    return null;
  }
}

/**
 * Try to parse and format JSON content for better readability.
 * Returns formatted JSON if successful, otherwise returns the original string.
 * Handles both regular JSON and JSON with escaped sequences (e.g., from stringified API responses).
 */
function tryFormatJson(str: string): { isJson: boolean; formatted: string } {
  const trimmed = str.trim();

  const looksLikeObjectOrArray =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));

  if (looksLikeObjectOrArray) {
    try {
      const parsed = JSON.parse(trimmed);
      return { isJson: true, formatted: JSON.stringify(parsed, null, 2) };
    } catch {
      // First parse failed, try decoding escape sequences
    }

    const decoded = decodeJsonEscapes(trimmed);
    if (decoded) {
      const decodedTrimmed = decoded.trim();
      if (decodedTrimmed.startsWith("{") || decodedTrimmed.startsWith("[")) {
        try {
          const reparsed = JSON.parse(decodedTrimmed);
          return { isJson: true, formatted: JSON.stringify(reparsed, null, 2) };
        } catch {
          return { isJson: false, formatted: decoded };
        }
      }
    }
  }

  return { isJson: false, formatted: str };
}

export type ErrorSource = "server" | "client";

/**
 * Format an error object for Slack reporting.
 *
 * @param error - The error to report
 * @param context - Additional context about where the error occurred (e.g. log message)
 * @param source - The source of the error: "server" (default) or "client"
 * @returns Slack message payload
 */
export function formatErrorForSlack(error: unknown, context?: string, source: ErrorSource = "server"): SlackMessage {
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

  const stackSource = getSourceFromStack(stackTrace);

  const fields: SlackAttachmentField[] = [
    {
      title: "Environment",
      value: env.NODE_ENV,
      short: true,
    },
    {
      title: "Context",
      value: context || "N/A",
      short: true,
    },
  ];

  if (stackSource) {
    fields.push({
      title: "Source",
      value: `\`${stackSource}\``,
      short: false,
    });
  }

  // Check if errorMessage is JSON and if so, use a generic title
  const { isJson, formatted } = tryFormatJson(errorMessage);
  const displayTitle = isJson ? "Error Object" : errorMessage;
  const displayText = isJson ? `\`\`\`${formatted}\`\`\`` : undefined;

  if (additionalDetails) {
    const truncatedDetails =
      additionalDetails.length > 1000 ? additionalDetails.substring(0, 1000) + "...(truncated)" : additionalDetails;
    fields.push({
      title: "Details",
      value: `\`\`\`${truncatedDetails}\`\`\``,
      short: false,
    });
  }

  const isClientError = source === "client";
  const errorLabel = isClientError ? "Client Error" : "Server Error";
  const emoji = "🚨";
  const color = "#D00000";

  const attachment: SlackAttachment = {
    fallback: `${emoji} ${errorLabel}: ${errorMessage}`,
    color,
    pretext: `${emoji} *${errorLabel} Occurred*`,
    title: displayTitle,
    fields,
    footer: "Doom Protocol Error Reporter",
    ts: Math.floor(Date.now() / 1000),
    mrkdwn_in: ["pretext", "text", "fields"],
  };

  // If we have a JSON error message, put it in the text (or append if stack exists)
  let mainText = displayText || "";

  if (stackTrace) {
    const truncatedStack = stackTrace.length > 2000 ? stackTrace.substring(0, 2000) + "\n...(truncated)" : stackTrace;
    mainText += (mainText ? "\n\n" : "") + `*Stack Trace:*\n\`\`\`${truncatedStack}\`\`\``;
  }

  if (mainText) {
    attachment.text = mainText;
  }

  return {
    attachments: [attachment],
  };
}
