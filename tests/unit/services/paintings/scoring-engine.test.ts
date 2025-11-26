import { ScoringEngine } from "@/services/paintings/scoring-engine";
import type { TokenCandidate } from "@/types/paintings";
import { describe, expect, it } from "bun:test";

const createCandidate = (overrides: Partial<TokenCandidate> = {}): TokenCandidate => ({
  id: "token-a",
  symbol: "AAA",
  name: "Token A",
  logoUrl: null,
  priceUsd: 1,
  priceChange24h: 10,
  priceChange7d: 15,
  volume24hUsd: 5_000_000,
  marketCapUsd: 100_000_000,
  categories: [],
  source: "coingecko-trending-search",
  trendingRankCgSearch: 1,
  ...overrides,
});

describe("ScoringEngine", () => {
  const engine = new ScoringEngine();

  it("assigns higher trend score to better ranked, higher volume tokens", () => {
    const highRank = engine.calculateTrendScore(
      createCandidate({
        trendingRankCgSearch: 1,
        volume24hUsd: 2_000_000_000,
      }),
    );

    const lowRank = engine.calculateTrendScore(
      createCandidate({
        trendingRankCgSearch: 15,
        volume24hUsd: 50_000,
      }),
    );

    expect(highRank).toBeGreaterThan(lowRank);
  });

  it("weights impact score by archetype and market metrics", () => {
    const l1Impact = engine.calculateImpactScore(
      createCandidate({
        categories: ["l1"],
        priceChange24h: 20,
        marketCapUsd: 400_000_000_000,
        volume24hUsd: 20_000_000_000,
      }),
    );

    const memeImpact = engine.calculateImpactScore(
      createCandidate({
        categories: ["meme"],
        priceChange24h: 20,
        marketCapUsd: 400_000_000_000,
        volume24hUsd: 20_000_000_000,
      }),
    );

    expect(l1Impact).toBeGreaterThan(memeImpact);
  });

  it("aligns mood score with market climate", () => {
    const rallyInEuphoria = engine.calculateMoodScore(createCandidate({ priceChange24h: 12 }), "euphoria");
    const rallyInPanic = engine.calculateMoodScore(createCandidate({ priceChange24h: 12 }), "panic");

    expect(rallyInEuphoria).toBeGreaterThan(rallyInPanic);

    const collapseInPanic = engine.calculateMoodScore(createCandidate({ priceChange24h: -12 }), "panic");
    expect(collapseInPanic).toBeGreaterThan(rallyInPanic);
  });

  it("combines scores using weighted final formula", () => {
    const finalScore = engine.calculateFinalScore({
      trend: 0.8,
      impact: 0.6,
      mood: 0.4,
    });

    // 0.5 * 0.8 + 0.35 * 0.6 + 0.15 * 0.4 = 0.67
    expect(finalScore).toBeCloseTo(0.67, 3);
  });
});
