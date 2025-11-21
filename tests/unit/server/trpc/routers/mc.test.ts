import { describe, it, expect } from "bun:test";
import { mcRouter } from "@/server/trpc/routers/mc";
import { createMockContext } from "../helpers";

const ZERO_MAP = {};

/**
 * Legacy MC Router tests
 * @deprecated These tests are for the legacy market cap API which is deprecated.
 */
describe("MC Router (legacy)", () => {
  it("should return empty map with generatedAt timestamp", async () => {
    const ctx = createMockContext();
    const caller = mcRouter.createCaller(ctx);

    const result = await caller.getMarketCaps();

    expect(result.tokens).toEqual(ZERO_MAP);
    expect(typeof result.generatedAt).toBe("string");
    expect(Number.isNaN(new Date(result.generatedAt).getTime())).toBe(false);
  });

  it("should always return empty map for rounded caps", async () => {
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
