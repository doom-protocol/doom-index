import type { AppError } from "@/types/app-error";
import type { Result } from "neverthrow";

/**
 * Legacy type aliases for backward compatibility.
 * The legacy 8-token system has been removed, but these exports remain for
 * code paths that have not been fully migrated yet.
 */
export type TokenTicker = string;

export interface TokenState {
  ticker: string;
  thumbnailUrl: string;
  updatedAt: string;
}

export interface ImageRequest {
  prompt: string;
  negative: string;
  width: number;
  height: number;
  format: "webp" | "png";
  seed: string;
  model?: string;
  referenceImageUrl?: string;
}

export interface ImageResponse {
  imageBuffer: ArrayBuffer;
  providerMeta: Record<string, unknown>;
}

/**
 * Common pagination options used across the application
 */
export interface PaginationOptions {
  limit?: number;
  cursor?: string;
  from?: string;
  to?: string;
}

export interface ImageGenerationOptions {
  timeoutMs?: number;
}

export interface ImageProvider {
  name: string;
  generate: (input: ImageRequest, options?: ImageGenerationOptions) => Promise<Result<ImageResponse, AppError>>;
}

export type SizeValue = `${number}vw` | `${number}px`;

export type ViewportSize =
  | { maxWidth: number; size: SizeValue }
  | { minWidth: number; size: SizeValue }
  | { size: SizeValue };

export type ResponsiveSizes = ViewportSize[];

export function buildSizesAttr(sizes?: ResponsiveSizes): string | undefined {
  if (!sizes || sizes.length === 0) return undefined;
  return sizes
    .map((s) => {
      if ("maxWidth" in s) return `(max-width: ${String(s.maxWidth)}px) ${s.size}`;
      if ("minWidth" in s) return `(min-width: ${String(s.minWidth)}px) ${s.size}`;
      return s.size;
    })
    .join(", ");
}
