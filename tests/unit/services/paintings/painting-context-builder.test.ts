import { describe, it, expect } from "bun:test";
import { ok, type Result } from "neverthrow";
import { PaintingContextBuilder } from "@/services/paintings/painting-context-builder";
import type { TokensRepository } from "@/repositories/tokens-repository";
import type { SelectedToken, MarketSnapshot } from "@/types/paintings";
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
});
