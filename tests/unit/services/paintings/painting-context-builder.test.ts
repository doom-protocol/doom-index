import { describe, it, expect } from "bun:test";
import { ok, type Result } from "neverthrow";
import { PaintingContextBuilder } from "@/services/paintings/painting-context-builder";
import { classifyDynamics } from "@/lib/pure/painting-context-classification";
import type { TokensRepository } from "@/repositories/tokens-repository";
import type { SelectedToken, MarketSnapshot, TokenSnapshot } from "@/types/paintings";
import type { PaintingContext } from "@/types/painting-context";
import type { Token } from "@/db/schema/tokens";
import type { AppError } from "@/types/app-error";

const token = (overrides: Partial<SelectedToken> = {}): SelectedToken => ({
  id: "alpha",
  symbol: "ALP",
  name: "Alpha",
  logoUrl: null,
  priceUsd: 12,
  priceChange24h: 8,
  priceChange7d: 25,
  volume24hUsd: 20_000_000,
  marketCapUsd: 500_000_000,
  categories: ["meme"],
  source: "coingecko-trending-search",
  scores: {
    trend: 0.8,
    impact: 0.7,
    mood: 0.6,
    final: 0.75,
  },
  ...overrides,
});

const snapshot = (overrides: Partial<MarketSnapshot> = {}): MarketSnapshot => ({
  totalMarketCapUsd: 2_000_000_000_000,
  totalVolumeUsd: 100_000_000_000,
  marketCapChangePercentage24hUsd: 4,
  btcDominance: 50,
  ethDominance: 20,
  activeCryptocurrencies: 10_000,
  markets: 500,
  fearGreedIndex: 80,
  updatedAt: 1_700_000_000,
  ...overrides,
});

describe("PaintingContextBuilder", () => {
  const createBuilder = (repoResult: Result<Token | null, AppError>) => {
    const tokensRepository: Pick<TokensRepository, "findById"> = {
      findById: async () => repoResult,
    };

    return new PaintingContextBuilder(tokensRepository as TokensRepository);
  };

  it("uses repository categories when available and builds full context", async () => {
    const builder = createBuilder(
      ok({
        id: "alpha",
        symbol: "ALP",
        name: "Alpha",
        coingeckoId: "alpha",
        logoUrl: null,
        shortContext: null,
        categories: JSON.stringify(["l1"]),
        createdAt: 0,
        updatedAt: 0,
      }),
    );

    const result = await builder.buildContext({
      selectedToken: token({ categories: ["meme"] }),
      marketSnapshot: snapshot(),
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const ctx: PaintingContext = result.value;
      expect(ctx.a).toBe("l1-sovereign");
      expect(ctx.c).toBe("euphoria");
      expect(ctx.e).toEqual({ k: "rally", i: 2 });
      expect(ctx.o).toBe("central-altar");
      expect(ctx.p).toBe("solar-gold");
      expect(ctx.f).toEqual(["unknown"]); // default motifs for l1-sovereign
      expect(ctx.h.length).toBeGreaterThan(0);
      expect(ctx.s.vol).toBeGreaterThan(0);
    }
  });

  it("falls back to token categories and handles JSON parse errors gracefully", async () => {
    const builder = createBuilder(
      ok({
        id: "alpha",
        symbol: "ALP",
        name: "Alpha",
        coingeckoId: "alpha",
        logoUrl: null,
        shortContext: null,
        categories: "invalid-json",
        createdAt: 0,
        updatedAt: 0,
      }),
    );

    const result = await builder.buildContext({
      selectedToken: token({ categories: ["meme"] }),
      marketSnapshot: snapshot({ marketCapChangePercentage24hUsd: -6, fearGreedIndex: 20 }),
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const ctx = result.value;
      expect(ctx.a).toBe("meme-ascendant");
      expect(ctx.c).toBe("despair");
      expect(ctx.p).toBe("ashen-blue");
    }
  });

  describe("volatilityScore calculation", () => {
    // Helper function to calculate expected volatility score
    const calculateExpectedVolatilityScore = (priceChange24h: number, priceChange7d: number): number => {
      return Math.min(1, (Math.abs(priceChange24h) + Math.abs(priceChange7d) / 7) / 50);
    };

    // Helper function to create a token snapshot with volatility score
    const createTokenSnapshot = (priceChange24h: number, priceChange7d: number): TokenSnapshot => {
      const volatilityScore = calculateExpectedVolatilityScore(priceChange24h, priceChange7d);
      return {
        p: priceChange24h,
        p7: priceChange7d,
        v: 1000000, // volume doesn't affect volatility
        mc: 100000000, // market cap doesn't affect volatility
        vol: volatilityScore,
      };
    };

    it("calculates volatility score with asymmetric weighting (24h direct, 7d averaged)", () => {
      // Test case: 10% 24h change, 35% 7d change
      // Expected: (|10| + |35| / 7) / 50 = (10 + 5) / 50 = 15/50 = 0.3
      const snapshot = createTokenSnapshot(10, 35);
      expect(snapshot.vol).toBe(0.3);
    });

    it("clamps volatility score to maximum of 1.0", () => {
      // Test case: very high changes that would exceed 1.0
      // (|50| + |350| / 7) / 50 = (50 + 50) / 50 = 100/50 = 2.0 → clamped to 1.0
      const snapshot = createTokenSnapshot(50, 350);
      expect(snapshot.vol).toBe(1.0);
    });

    it("handles zero price changes correctly", () => {
      // Test case: no price changes
      // (|0| + |0| / 7) / 50 = (0 + 0) / 50 = 0
      const snapshot = createTokenSnapshot(0, 0);
      expect(snapshot.vol).toBe(0);
    });

    it("handles negative price changes (absolute values used)", () => {
      // Test case: -15% 24h, -42% 7d
      // (| -15| + | -42| / 7) / 50 = (15 + 6) / 50 = 21/50 = 0.42
      const snapshot = createTokenSnapshot(-15, -42);
      expect(snapshot.vol).toBe(0.42);
    });

    describe("volatility classification thresholds", () => {
      it("classifies volatilityScore <= 0.33 as 'low'", () => {
        // Test edge case: exactly 0.33 should be "low" (not medium)
        const snapshot = createTokenSnapshot(16.5, 0); // (|16.5| + |0| / 7) / 50 = 16.5/50 = 0.33
        const { vol } = classifyDynamics(snapshot);
        expect(vol).toBe("low");

        // Test below threshold
        const snapshotBelow = createTokenSnapshot(16.4, 0); // 16.4/50 = 0.328
        const { vol: volBelow } = classifyDynamics(snapshotBelow);
        expect(volBelow).toBe("low");
      });

      it("classifies volatilityScore > 0.33 and <= 0.66 as 'medium'", () => {
        // Test just above 0.33 threshold
        const snapshot = createTokenSnapshot(16.6, 0); // (|16.6| + |0| / 7) / 50 = 16.6/50 = 0.332
        const { vol } = classifyDynamics(snapshot);
        expect(vol).toBe("medium");

        // Test exactly 0.66 (boundary case)
        const snapshotBoundary = createTokenSnapshot(33, 0); // (|33| + |0| / 7) / 50 = 33/50 = 0.66
        const { vol: volBoundary } = classifyDynamics(snapshotBoundary);
        expect(volBoundary).toBe("medium");

        // Test in middle of range
        const snapshotMiddle = createTokenSnapshot(25, 0); // (|25| + |0| / 7) / 50 = 25/50 = 0.5
        const { vol: volMiddle } = classifyDynamics(snapshotMiddle);
        expect(volMiddle).toBe("medium");
      });

      it("classifies volatilityScore > 0.66 as 'high'", () => {
        // Test just above 0.66 threshold
        const snapshot = createTokenSnapshot(33.1, 0); // (|33.1| + |0| / 7) / 50 = 33.1/50 = 0.662
        const { vol } = classifyDynamics(snapshot);
        expect(vol).toBe("high");

        // Test high value
        const snapshotHigh = createTokenSnapshot(40, 50); // (|40| + |50| / 7) / 50 = (40 + 7.14) / 50 = 47.14/50 = 0.9428
        const { vol: volHigh } = classifyDynamics(snapshotHigh);
        expect(volHigh).toBe("high");

        // Test maximum (clamped to 1.0)
        const snapshotMax = createTokenSnapshot(50, 350); // Clamped to 1.0
        const { vol: volMax } = classifyDynamics(snapshotMax);
        expect(volMax).toBe("high");
      });
    });

    describe("realistic token scenarios", () => {
      it("handles typical stable coin volatility", () => {
        // Stable coin: small daily changes, minimal weekly volatility
        const snapshot = createTokenSnapshot(0.1, 0.5); // 0.1% daily, 0.5% weekly
        const expected = (0.1 + 0.5 / 7) / 50; // ≈ 0.00214
        expect(snapshot.vol).toBe(expected);
        const { vol } = classifyDynamics(snapshot);
        expect(vol).toBe("low");
      });

      it("handles moderate altcoin volatility", () => {
        // Moderate altcoin: 5% daily, 25% weekly
        const snapshot = createTokenSnapshot(5, 25); // (|5| + |25| / 7) / 50 = (5 + 3.57) / 50 ≈ 0.1714
        expect(snapshot.vol).toBeCloseTo(0.1714, 4);
        const { vol } = classifyDynamics(snapshot);
        expect(vol).toBe("low");
      });

      it("handles high volatility meme coin", () => {
        // High volatility meme: 20% daily, 150% weekly
        const snapshot = createTokenSnapshot(20, 150); // (|20| + |150| / 7) / 50 = (20 + 21.43) / 50 = 41.43/50 = 0.8286
        expect(snapshot.vol).toBeCloseTo(0.8286, 4);
        const { vol } = classifyDynamics(snapshot);
        expect(vol).toBe("high");
      });
    });
  });
});
