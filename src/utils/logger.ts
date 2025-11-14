import { env } from "../env";

export enum LogLevel {
  ERROR = "ERROR",
  WARN = "WARN",
  INFO = "INFO",
  DEBUG = "DEBUG",
  LOG = "LOG",
}

const LOG_LEVELS = [LogLevel.ERROR, LogLevel.WARN, LogLevel.LOG, LogLevel.INFO, LogLevel.DEBUG];

// Define log level priority (lower number = higher priority)
const LOG_LEVEL_PRIORITY = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.LOG]: 2,
  [LogLevel.INFO]: 3,
  [LogLevel.DEBUG]: 4,
} as const;

const getTimestamp = () => {
  return new Date().toISOString();
};

const getCurrentLogLevel = (): LogLevel => {
  const envLevel = env.NEXT_PUBLIC_LOG_LEVEL;
  if (envLevel && LOG_LEVELS.includes(envLevel as LogLevel)) {
    return envLevel as LogLevel;
  }

  return LogLevel.INFO;
};

// Check if a log at the specified level should be output
const shouldLog = (level: LogLevel): boolean => {
  const currentLevel = getCurrentLogLevel();
  return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[currentLevel];
};

const colorize = (message: string, level: LogLevel): string => {
  const colors = {
    [LogLevel.ERROR]: "\x1b[31m", // Red
    [LogLevel.WARN]: "\x1b[33m", // Yellow
    [LogLevel.INFO]: "\x1b[36m", // Cyan
    [LogLevel.DEBUG]: "\x1b[32m", // Green
    [LogLevel.LOG]: null, // No color (standard)
  };

  const reset = "\x1b[0m";
  const color = colors[level];

  if (color === null) {
    return message; // No color for LOG
  }

  return `${color}${message}${reset}`;
};

const formatHeader = (level: LogLevel): string => {
  const timestamp = `[${getTimestamp()}]`;
  const levelTag = `[${level}]`;
  return colorize(`${timestamp} ${levelTag}`, level);
};

export const logger = {
  log: (...args: unknown[]) => {
    if (!shouldLog(LogLevel.LOG)) return;
    const header = formatHeader(LogLevel.LOG);
    console.log(header, ...args);
  },
  info: (...args: unknown[]) => {
    if (!shouldLog(LogLevel.INFO)) return;
    const header = formatHeader(LogLevel.INFO);
    console.info(header, ...args);
  },
  debug: (...args: unknown[]) => {
    if (!shouldLog(LogLevel.DEBUG)) return;
    const header = formatHeader(LogLevel.DEBUG);
    console.log(header, ...args);
  },
  warn: (...args: unknown[]) => {
    if (!shouldLog(LogLevel.WARN)) return;
    const header = formatHeader(LogLevel.WARN);
    console.warn(header, ...args);
  },
  error: (...args: unknown[]) => {
    if (!shouldLog(LogLevel.ERROR)) return;
    const header = formatHeader(LogLevel.ERROR);
    console.error(header, ...args);
  },
  /**
   * Get the currently set log level
   */
  getCurrentLevel: (): LogLevel => getCurrentLogLevel(),
  /**
   * Get list of available log levels
   */
  getLevels: () => LOG_LEVELS,
};
