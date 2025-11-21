import type { Result } from "neverthrow";
import type { TokenTicker, McMap } from "@/constants/token";
import type { AppError } from "@/types/app-error";

export type { TokenTicker, McMap };

export type GlobalState = {
  prevHash: string | null;
  lastTs: string | null;
  imageUrl?: string | null;
};

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
