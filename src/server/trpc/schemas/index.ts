import { z } from "zod";
import { TOKEN_TICKERS } from "@/constants/token";

// Token Ticker Schema
export const tokenTickerSchema = z.enum(TOKEN_TICKERS as unknown as [string, ...string[]]);

// Viewer Schemas
export const viewerRegisterSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  userAgent: z.string().optional(),
});

export const viewerRemoveSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
});

// Token Schemas
export const tokenGetStateSchema = z.object({
  ticker: tokenTickerSchema,
});

// R2 Schemas
export const r2GetObjectSchema = z.object({
  key: z.array(z.string().min(1)).min(1, "At least one key segment is required"),
});

// 型推論ヘルパー
export type TokenTicker = z.infer<typeof tokenTickerSchema>;
export type ViewerRegisterInput = z.infer<typeof viewerRegisterSchema>;
export type ViewerRemoveInput = z.infer<typeof viewerRemoveSchema>;
export type TokenGetStateInput = z.infer<typeof tokenGetStateSchema>;
export type R2GetObjectInput = z.infer<typeof r2GetObjectSchema>;
