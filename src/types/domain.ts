import type { AppError } from "@/types/app-error";
import type { Result } from "neverthrow";

/**
 * Legacy type aliases for backward compatibility
 * @deprecated These types are for backward compatibility only.
 * The legacy 8-token system has been removed.
 */
export type TokenTicker = string;

export type TokenState = {
  ticker: TokenTicker;
  thumbnailUrl: string;
  updatedAt: string;
};

export type ImageRequest = {
  prompt: string;
  negative: string;
  width: number;
  height: number;
  format: "webp" | "png";
  seed: string;
  model?: string;
  referenceImageUrl?: string;
};

export type ImageResponse = {
  imageBuffer: ArrayBuffer;
  providerMeta: Record<string, unknown>;
};

/**
 * Common pagination options used across the application
 */
export interface PaginationOptions {
  limit?: number;
  cursor?: string;
  from?: string;
  to?: string;
}

export type ImageGenerationOptions = {
  timeoutMs?: number;
};

export interface ImageProvider {
  name: string;
  generate(input: ImageRequest, options?: ImageGenerationOptions): Promise<Result<ImageResponse, AppError>>;
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
    .map(s => {
      if ("maxWidth" in s) return `(max-width: ${s.maxWidth}px) ${s.size}`;
      if ("minWidth" in s) return `(min-width: ${s.minWidth}px) ${s.size}`;
      return s.size;
    })
    .join(", ");
}
