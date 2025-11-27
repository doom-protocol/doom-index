"use client";

import { logger } from "@/utils/logger";

const reportedKeys = new Set<string>();

type ClientErrorPayload = {
  error: unknown;
  context?: string;
  componentStack?: string;
  extra?: Record<string, unknown>;
};

export async function reportClientError(payload: ClientErrorPayload): Promise<void> {
  try {
    const key = JSON.stringify({
      context: payload.context,
      extra: payload.extra,
    });

    if (reportedKeys.has(key)) return;
    reportedKeys.add(key);

    const { error, ...rest } = payload;
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const body = {
      message,
      stack,
      ...rest,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };

    await fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch (e) {
    logger.error("Failed to report client error", e);
  }
}
