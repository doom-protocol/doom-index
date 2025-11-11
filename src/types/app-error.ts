export type ExternalApiError = {
  type: "ExternalApiError";
  provider: "DexScreener" | "ImageProvider";
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

export type AppError = ExternalApiError | StorageError | ValidationError | InternalError;
