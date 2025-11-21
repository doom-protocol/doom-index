export type ExternalApiError = {
  type: "ExternalApiError";
  provider: "DexScreener" | "ImageProvider" | "WorkersAI" | "Tavily";
  status?: number;
  message: string;
  ticker?: string;
};

export type StorageError = {
  type: "StorageError";
  op: "get" | "put" | "delete" | "list";
  key: string;
  message: string;
};

export type ValidationError = {
  type: "ValidationError";
  message: string;
  details?: unknown;
};

export type InternalError = {
  type: "InternalError";
  message: string;
  cause?: unknown;
};

export type ConfigurationError = {
  type: "ConfigurationError";
  message: string;
  missingVar?: string;
};

export type ParsingError = {
  type: "ParsingError";
  message: string;
  rawValue?: string;
};

export type TimeoutError = {
  type: "TimeoutError";
  message: string;
  timeoutMs: number;
  elapsedMs?: number;
};

export type AppError =
  | ExternalApiError
  | StorageError
  | ValidationError
  | InternalError
  | ConfigurationError
  | ParsingError
  | TimeoutError;
