/**
 * Time Utilities
 *
 * Provides functions for time-related operations including timeouts.
 */

import type { TimeoutError } from "@/types/app-error";

/**
 * Returns an ISO-like minute bucket string that is stable within the same minute.
 * Example: "2025-11-09T12:34"
 */
export function getMinuteBucket(date: Date = new Date()): string {
  const copy = new Date(date.getTime());
  copy.setSeconds(0, 0);
  // Keep it simple and deterministic; ISO 8601 up to minutes
  return copy.toISOString().slice(0, 16);
}

/**
 * Returns an ISO-like hour bucket string that is stable within the same hour.
 * Example: "2025-11-09T12"
 */
export function getHourBucket(date: Date = new Date()): string {
  const copy = new Date(date.getTime());
  copy.setMinutes(0, 0, 0);
  // Keep it simple and deterministic; ISO 8601 up to hours
  return copy.toISOString().slice(0, 13);
}

/**
 * Create timeout promise
 * Returns a promise that resolves to a TimeoutError after the specified duration
 *
 * @param ms - Timeout duration in milliseconds
 * @param message - Custom timeout message (optional)
 * @returns Promise that resolves to TimeoutError after timeout
 */
export function createTimeoutPromise(ms: number, message?: string): Promise<TimeoutError> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        type: "TimeoutError",
        message: message ?? `Request timed out after ${ms}ms`,
        timeoutMs: ms,
      });
    }, ms);
  });
}
