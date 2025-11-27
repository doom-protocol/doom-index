import { env } from "@/env";
import { sendSlackMessage } from "@/lib/slack-client";
import { logger } from "@/utils/logger";
import { NextResponse } from "next/server";

type ClientErrorBody = {
  message?: string;
  stack?: string;
  componentStack?: string;
  context?: string;
  url?: string;
  userAgent?: string;
  extra?: Record<string, unknown>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ClientErrorBody;
    const { message, stack, componentStack, context, url, userAgent, extra } = body;

    const title = context ?? "Client Error";
    const baseMessage = message ?? "Unknown client-side error";

    logger.error("client-error.received", { title, message: baseMessage, url, userAgent, extra });

    const truncateString = (str: string | undefined, maxLength: number): string | undefined => {
      if (!str) return undefined;
      return str.length > maxLength ? `${str.substring(0, maxLength)}...(truncated)` : str;
    };

    const slackTextLines = [
      ":rotating_light: *Client Error*",
      "",
      `*Environment:* ${env.NODE_ENV}`,
      `*Context:* ${title}`,
      url ? `*URL:* ${url}` : null,
      userAgent ? `*User Agent:* \`${truncateString(userAgent, 200)}\`` : null,
      "",
      `*Message:* ${baseMessage}`,
      stack ? `*Stack:*\n\`\`\`${truncateString(stack, 1500)}\`\`\`` : null,
      componentStack ? `*Component Stack:*\n\`\`\`${truncateString(componentStack, 1000)}\`\`\`` : null,
      extra ? `*Extra:*\n\`\`\`${truncateString(JSON.stringify(extra, null, 2), 500)}\`\`\`` : null,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    const result = await sendSlackMessage({
      text: `Client Error: ${title}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: slackTextLines,
          },
        },
      ],
    });

    if (result.isErr()) {
      logger.error("client-error.slack-failed", { error: result.error });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("client-error.route-failed", { error });
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
