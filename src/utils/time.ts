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
 * Returns an ISO-like interval bucket string that is stable within the specified interval.
 * The interval is defined by NEXT_PUBLIC_GENERATION_INTERVAL_MS environment variable.
 * Example: "2025-11-09T12:00" (for 10-minute intervals)
 */
export function getIntervalBucket(date: Date = new Date(), intervalMs: number = 600000): string {
  const copy = new Date(date.getTime());
  // Calculate which interval this timestamp falls into
  const intervalMinutes = Math.floor(intervalMs / 60000);
  const minutesSinceEpoch = Math.floor(copy.getTime() / 60000);
  const intervalStartMinutes = Math.floor(minutesSinceEpoch / intervalMinutes) * intervalMinutes;
  const intervalStartTime = new Date(intervalStartMinutes * 60000);

  // Return ISO string up to minutes
  return intervalStartTime.toISOString().slice(0, 16);
}

/**
 * Formats a date to a short month-day string (e.g., "Jan 15")
 *
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateShort(date: Date): string {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = monthNames[date.getMonth()];
  const d = date.getDate();
  return `${m} ${d}`;
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
