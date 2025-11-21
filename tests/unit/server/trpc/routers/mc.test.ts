import { describe, it, expect } from "bun:test";
import { mcRouter } from "@/server/trpc/routers/mc";
import { createMockContext } from "../helpers";
import { TOKEN_TICKERS } from "@/constants/token";

const ZERO_MAP = TOKEN_TICKERS.reduce(
  (acc, ticker) => {
    acc[ticker] = 0;
    return acc;
  },
  {} as Record<(typeof TOKEN_TICKERS)[number], number>,
);

describe("MC Router", () => {
  it("should return zero map with generatedAt timestamp", async () => {
    const ctx = createMockContext();
    const caller = mcRouter.createCaller(ctx);

    const result = await caller.getMarketCaps();

    expect(result.tokens).toEqual(ZERO_MAP);
    expect(typeof result.generatedAt).toBe("string");
    expect(Number.isNaN(new Date(result.generatedAt).getTime())).toBe(false);
  });

  it("should always return zero map for rounded caps", async () => {
    const ctx = createMockContext();
    const caller = mcRouter.createCaller(ctx);

    const result = await caller.getRoundedMcMap();

    expect(result.tokens).toEqual(ZERO_MAP);
    expect(typeof result.generatedAt).toBe("string");
  });

  it("should return consistent tokens across calls", async () => {
    const ctx = createMockContext();
    const caller = mcRouter.createCaller(ctx);

    const first = await caller.getMarketCaps();
    const second = await caller.getMarketCaps();

    expect(first.tokens).toEqual(second.tokens);
  });
});
