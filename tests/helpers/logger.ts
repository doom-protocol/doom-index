/**
 * Shared logger mock utilities for tests
 * Provides a consistent way to capture and assert on logger calls
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
