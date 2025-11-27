"use client";

import * as Sentry from "@sentry/react";

let isInitialized = false;

export function initSentry(): void {
  if (isInitialized) return;
  if (typeof window === "undefined") return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    integrations: [Sentry.browserTracingIntegration()],
  });

  isInitialized = true;
}

export { Sentry };
