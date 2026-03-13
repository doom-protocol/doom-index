interface ExternalApiError {
  type: "ExternalApiError";
  provider: "ImageProvider" | "WorkersAI" | "Tavily" | "coingecko" | "alternative.me" | "runware" | "ardrive";
  status?: number;
  message: string;
  ticker?: string;
  details?: unknown;
}

interface StorageError {
  type: "StorageError";
  op: "get" | "put" | "delete" | "list";
  key: string;
  status?: number;
  message: string;
}

interface ValidationError {
  type: "ValidationError";
  message: string;
  details?: unknown;
  status?: number;
}

interface InternalError {
  type: "InternalError";
  message: string;
  cause?: unknown;
  status?: number;
}

export interface ConfigurationError {
  type: "ConfigurationError";
  message: string;
  missingVar?: string;
  status?: number;
}

export interface ParsingError {
  type: "ParsingError";
  message: string;
  rawValue?: string;
  status?: number;
}

export interface TimeoutError {
  type: "TimeoutError";
  message: string;
  timeoutMs: number;
  elapsedMs?: number;
  status?: number;
}

export type AppError =
  | ExternalApiError
  | StorageError
  | ValidationError
  | InternalError
  | ConfigurationError
  | ParsingError
  | TimeoutError;
