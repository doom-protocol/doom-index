/**
 * Mock utilities for logger
 * Provides reusable mocks for logger modules
 *
 * Usage:
 *   import { mock } from "bun:test";
 *   import { createLoggerMockFactory } from "@/tests/mocks/logger";
 *
 *   const { mockFactory, mockLogger } = createLoggerMockFactory();
 *   mock.module("@/utils/logger", mockFactory);
 */

export interface LoggerCall {
  method: string;
  args: unknown[];
}

export interface LoggerMock {
  debug: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
  getCurrentLevel: () => string;
  getLevels: () => string[];
}

/**
 * Create a logger mock that captures all calls for assertions
 * @returns Object containing the mock logger and captured calls array
 */
export function createLoggerMock(): { logger: LoggerMock; calls: LoggerCall[] } {
  const calls: LoggerCall[] = [];

  const logger: LoggerMock = {
    debug: (...args: unknown[]) => {
      calls.push({ method: "debug", args });
    },
    error: (...args: unknown[]) => {
      calls.push({ method: "error", args });
    },
    info: (...args: unknown[]) => {
      calls.push({ method: "info", args });
    },
    warn: (...args: unknown[]) => {
      calls.push({ method: "warn", args });
    },
    log: (...args: unknown[]) => {
      calls.push({ method: "log", args });
    },
    getCurrentLevel: () => "DEBUG",
    getLevels: () => ["ERROR", "WARN", "LOG", "INFO", "DEBUG"],
  };

  return { logger, calls };
}

/**
 * Create mock factory for @/utils/logger
 * Returns both the mock factory function and the logger instance
 */
export function createLoggerMockFactory() {
  const { logger: mockLogger, calls } = createLoggerMock();
  return {
    mockFactory: () => ({ logger: mockLogger }),
    mockLogger,
    calls,
  };
}

/**
 * Find a specific log call by method and message prefix
 */
export function findLogCall(calls: LoggerCall[], method: string, messagePrefix: string): LoggerCall | undefined {
  return calls.find(
    call => call.method === method && typeof call.args[0] === "string" && call.args[0].startsWith(messagePrefix),
  );
}

/**
 * Filter log calls by method
 */
export function filterLogsByMethod(calls: LoggerCall[], method: string): LoggerCall[] {
  return calls.filter(call => call.method === method);
}

/**
 * Clear all captured log calls
 */
export function clearLogCalls(calls: LoggerCall[]): void {
  calls.length = 0;
}
