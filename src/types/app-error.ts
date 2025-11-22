export type ExternalApiError = {
  type: "ExternalApiError";
  provider: "ImageProvider" | "WorkersAI" | "Tavily" | "coingecko" | "alternative.me" | "runware";
  status?: number;
  message: string;
  ticker?: string;
};

export type StorageError = {
  type: "StorageError";
  op: "get" | "put" | "delete" | "list";
  key: string;
  status?: number;
  message: string;
};

export type ValidationError = {
  type: "ValidationError";
  message: string;
  details?: unknown;
  status?: number;
};

export type InternalError = {
  type: "InternalError";
  message: string;
  cause?: unknown;
  status?: number;
};

export type ConfigurationError = {
  type: "ConfigurationError";
  message: string;
  missingVar?: string;
  status?: number;
};

export type ParsingError = {
  type: "ParsingError";
  message: string;
  rawValue?: string;
  status?: number;
};

export type TimeoutError = {
  type: "TimeoutError";
  message: string;
  timeoutMs: number;
  elapsedMs?: number;
  status?: number;
};

export type AppError =
  | ExternalApiError
  | StorageError
  | ValidationError
  | InternalError
  | ConfigurationError
  | ParsingError
  | TimeoutError;
