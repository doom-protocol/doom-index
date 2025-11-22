import type { Result } from "neverthrow";
import type { AppError } from "@/types/app-error";

/**
 * Legacy type aliases for backward compatibility
 * @deprecated These types are for backward compatibility only.
 * The legacy 8-token system has been removed.
 */
export type TokenTicker = string;
export type McMap = Record<string, number>;


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

export type ImageGenerationOptions = {
  timeoutMs?: number;
};

export interface ImageProvider {
  name: string;
  generate(input: ImageRequest, options?: ImageGenerationOptions): Promise<Result<ImageResponse, AppError>>;
}
