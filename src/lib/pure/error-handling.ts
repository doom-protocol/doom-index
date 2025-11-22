import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";

/**
 * Common external API error handling utilities
 * Centralizes error handling patterns used across API clients
 */

/**
 * Valid external API provider names
 */
export type ApiProvider =
  | "ImageProvider"
  | "WorkersAI"
  | "Tavily"
  | "coingecko"
  | "alternative.me"
  | "runware"
  | "pinata";

/**
 * Standard error context for API error logging
 */
export type ApiErrorContext = {
  provider: ApiProvider;
  operation?: string;
  [key: string]: unknown;
};

/**
 * Extract standardized error message from unknown error
 */
export function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Extract error stack if available
 */
export function extractErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

/**
 * Create standardized ExternalApiError
 */
export function createExternalApiError(
  provider: ApiProvider,
  message: string,
  status?: number,
  context?: Record<string, unknown>,
): AppError {
  return {
    type: "ExternalApiError",
    provider,
    message,
    status,
    ...context,
  };
}

/**
 * Create standardized TimeoutError
 */
export function createTimeoutError(provider: ApiProvider, timeoutMs: number, operation?: string): AppError {
  return {
    type: "TimeoutError",
    message: `${provider} ${operation ?? "request"} timed out after ${timeoutMs}ms`,
    timeoutMs,
  };
}

/**
 * Common API error handling with specific error type detection
 * Handles rate limits, network errors, authentication errors, and generic API errors
 */
export function handleApiError(error: unknown, context: ApiErrorContext, log = logger): AppError {
  const message = extractErrorMessage(error);
  const stack = extractErrorStack(error);

  // Log the error with structured context
  log.error(`${context.provider}.error`, {
    ...context,
    errorType: "ExternalApiError",
    message,
    stack,
  });

  // Check for specific error types
  if (error instanceof Error) {
    // Rate limit errors (429)
    if (message.includes("429") || message.toLowerCase().includes("rate limit")) {
      return createExternalApiError(context.provider, `Rate limit exceeded: ${message}`, 429);
    }

    // Network errors
    if (
      message.includes("fetch") ||
      message.includes("network") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND")
    ) {
      return createExternalApiError(context.provider, `Network error: ${message}`);
    }

    // Authentication errors (401)
    if (
      message.includes("401") ||
      message.toLowerCase().includes("unauthorized") ||
      message.toLowerCase().includes("authentication")
    ) {
      return createExternalApiError(context.provider, `Authentication failed: ${message}`, 401);
    }
  }

  // Generic external API error
  return createExternalApiError(context.provider, message);
}

/**
 * Handle timeout errors specifically
 */
export function handleTimeoutError(timeoutMs: number, context: ApiErrorContext, log = logger): AppError {
  log.error(`${context.provider}.timeout`, {
    ...context,
    timeoutMs,
  });

  return createTimeoutError(context.provider, timeoutMs, context.operation);
}
