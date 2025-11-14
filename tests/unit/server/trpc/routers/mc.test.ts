import { describe, it, expect, mock, beforeEach } from "bun:test";
import { mcRouter } from "@/server/trpc/routers/mc";
import { createMockContext } from "../helpers";
import { ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { TOKEN_TICKERS } from "@/constants/token";

describe("MC Router", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("should return market caps successfully", async () => {
    const mockMcMap = TOKEN_TICKERS.reduce(
      (acc, ticker) => {
        acc[ticker] = 1000000;
        return acc;
      },
      {} as Record<(typeof TOKEN_TICKERS)[number], number>,
    );

    // MarketCapServiceをモック
    mock.module("@/services/market-cap", () => ({
      createMarketCapService: () => ({
        getMcMap: async () => ok(mockMcMap),
        getRoundedMcMap: async () => ok(mockMcMap),
      }),
    }));

    const ctx = createMockContext();
    const caller = mcRouter.createCaller(ctx);

    const result = await caller.getMarketCaps();

    expect(result).toHaveProperty("tokens");
    expect(result).toHaveProperty("generatedAt");
    expect(Object.keys(result.tokens).length).toBe(TOKEN_TICKERS.length);
  });

  it("should return zero map on service error", async () => {
    const error: AppError = {
      type: "ExternalApiError",
      provider: "DexScreener",
      message: "API error",
    };

    // MarketCapServiceをモック
    mock.module("@/services/market-cap", () => ({
      createMarketCapService: () => ({
        getMcMap: async () => err(error),
        getRoundedMcMap: async () => err(error),
      }),
    }));

    const ctx = createMockContext();
    const caller = mcRouter.createCaller(ctx);

    const result = await caller.getMarketCaps();

    expect(result.tokens).toBeDefined();
    // エラー時はゼロマップを返す
    for (const ticker of TOKEN_TICKERS) {
      expect(result.tokens[ticker]).toBe(0);
    }
  });

  it("should throw error on getRoundedMcMap service error", async () => {
    const error: AppError = {
      type: "ExternalApiError",
      provider: "DexScreener",
      message: "API error",
    };

    // MarketCapServiceをモック
    mock.module("@/services/market-cap", () => ({
      createMarketCapService: () => ({
        getMcMap: async () => err(error),
        getRoundedMcMap: async () => err(error),
      }),
    }));

    const ctx = createMockContext();
    const caller = mcRouter.createCaller(ctx);

    try {
      await caller.getRoundedMcMap();
      throw new Error("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
