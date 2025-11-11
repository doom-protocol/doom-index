import type { Result } from "neverthrow";
import type { TokenTicker, McMap } from "@/constants/token";
import type { AppError } from "@/types/app-error";

export type { TokenTicker, McMap };

export type GlobalState = {
  prevHash: string | null;
  lastTs: string | null;
  imageUrl?: string | null;
  revenueMinute?: string | null;
};

export type TokenState = {
  ticker: TokenTicker;
  thumbnailUrl: string;
  updatedAt: string;
};

export type RevenueReport = {
  perTokenFee: Record<TokenTicker, number>;
  totalFee: number;
  monthlyCost: number;
  netProfit: number;
};

export type TradeSnapshot = {
  ticker: TokenTicker;
  tradesPerMinute: number;
  averageTradeUsd: number;
};

export type ImageRequest = {
  prompt: string;
  negative: string;
  width: number;
  height: number;
  format: "webp" | "png";
  seed: string;
  model?: string;
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

export interface StateService {
  readGlobalState(): Promise<Result<GlobalState | null, AppError>>;
  writeGlobalState(state: GlobalState): Promise<Result<void, AppError>>;
  readTokenState(ticker: TokenTicker): Promise<Result<TokenState | null, AppError>>;
  writeTokenStates(states: TokenState[]): Promise<Result<void, AppError>>;
  storeImage(key: string, buf: ArrayBuffer): Promise<Result<string, AppError>>;
  writeRevenue(report: RevenueReport, minuteIso: string): Promise<Result<void, AppError>>;
  readRevenue(minuteIso: string): Promise<Result<RevenueReport | null, AppError>>;
}

export interface RevenueEngine {
  calculateMinuteRevenue(input: TradeSnapshot[], generationRate: number): Result<RevenueReport, AppError>;
}
