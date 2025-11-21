import { describe, it, expect } from "bun:test";
import {
  classifyMarketClimate,
  classifyTokenArchetype,
  classifyEventPressure,
  pickComposition,
  pickPalette,
  classifyDynamics,
  deriveMotifs,
  deriveNarrativeHints,
} from "@/lib/pure/painting-context-classification";
import type { MarketSnapshot, TokenSnapshot, SelectedToken } from "@/types/paintings";
import type { MarketClimate, TokenArchetype } from "@/types/painting-context";

const snapshot = (overrides: Partial<MarketSnapshot> = {}): MarketSnapshot => ({
  totalMarketCapUsd: 2_000_000_000_000,
  totalVolumeUsd: 100_000_000_000,
  marketCapChangePercentage24hUsd: 0,
  btcDominance: 50,
  ethDominance: 20,
  activeCryptocurrencies: 10_000,
  markets: 500,
  fearGreedIndex: 60,
  updatedAt: 1_700_000_000,
  ...overrides,
});

const tokenSnapshot = (overrides: Partial<TokenSnapshot> = {}): TokenSnapshot => ({
  p: 0,
  p7: 0,
  v: 1_000_000,
  mc: 100_000_000,
  vol: 0.5,
  ...overrides,
});

const token = (overrides: Partial<SelectedToken> = {}): SelectedToken => ({
  id: "token",
  symbol: "AAA",
  name: "Token",
  logoUrl: null,
  priceUsd: 1,
  priceChange24h: 0,
  priceChange7d: 0,
  volume24hUsd: 1_000_000,
  marketCapUsd: 100_000_000,
  categories: [],
  source: "coingecko-trending-search",
  scores: {
    trend: 0,
    impact: 0,
    mood: 0,
    final: 0,
  },
  ...overrides,
});

describe("painting-context-classification", () => {
  it("classifies market climate based on change and FGI", () => {
    const cases: Array<{ input: MarketSnapshot; expected: MarketClimate }> = [
      { input: snapshot({ marketCapChangePercentage24hUsd: 4, fearGreedIndex: 80 }), expected: "euphoria" },
      { input: snapshot({ marketCapChangePercentage24hUsd: 2 }), expected: "cooling" },
      { input: snapshot({ marketCapChangePercentage24hUsd: -6 }), expected: "despair" },
      { input: snapshot({ marketCapChangePercentage24hUsd: -2 }), expected: "panic" },
      { input: snapshot({ marketCapChangePercentage24hUsd: 0 }), expected: "transition" },
    ];

    for (const { input, expected } of cases) {
      expect(classifyMarketClimate(input)).toBe(expected);
    }
  });

  it("maps categories to token archetypes", () => {
    const archetypes: Array<{ cats: string[]; expected: TokenArchetype }> = [
      { cats: ["perp"], expected: "perp-liquidity" },
      { cats: ["meme"], expected: "meme-ascendant" },
      { cats: ["layer-1"], expected: "l1-sovereign" },
      { cats: ["privacy"], expected: "privacy" },
      { cats: ["ai"], expected: "ai-oracle" },
      { cats: ["political"], expected: "political" },
      { cats: ["unknown"], expected: "unknown" },
    ];

    const t = token();
    archetypes.forEach(({ cats, expected }) => {
      expect(classifyTokenArchetype(t, cats)).toBe(expected);
    });
  });

  it("classifies event pressure by price change", () => {
    expect(classifyEventPressure(tokenSnapshot({ p: 12 }))).toEqual({ k: "rally", i: 3 });
    expect(classifyEventPressure(tokenSnapshot({ p: 7 }))).toEqual({ k: "rally", i: 2 });
    expect(classifyEventPressure(tokenSnapshot({ p: -8 }))).toEqual({ k: "collapse", i: 2 });
    expect(classifyEventPressure(tokenSnapshot({ p: 1 }))).toEqual({ k: "ritual", i: 1 });
  });

  it("selects composition and palette based on climate/archetype/event", () => {
    const event = { k: "rally" as const, i: 3 as const };

    expect(pickComposition("transition", "perp-liquidity", event)).toBe("citadel-panorama");
    expect(pickComposition("transition", "meme-ascendant", event)).toBe("procession");
    expect(pickComposition("euphoria", "unknown", event)).toBe("central-altar");
    expect(pickComposition("despair", "unknown", { k: "collapse" as const, i: 3 as const })).toBe("storm-battlefield");
    expect(pickComposition("transition", "unknown", event)).toBe("cosmic-horizon");

    expect(pickPalette("euphoria", "unknown", event)).toBe("solar-gold");
    expect(pickPalette("panic", "unknown", event)).toBe("ashen-blue");
    expect(pickPalette("transition", "meme-ascendant", event)).toBe("infernal-red");
    expect(pickPalette("transition", "unknown", { k: "collapse" as const, i: 1 as const })).toBe("ivory-marble");
  });

  it("classifies dynamics using thresholds", () => {
    expect(classifyDynamics(tokenSnapshot({ p: 4, vol: 0.8 }))).toEqual({ dir: "up", vol: "high" });
    expect(classifyDynamics(tokenSnapshot({ p: -4, vol: 0.5 }))).toEqual({ dir: "down", vol: "medium" });
    expect(classifyDynamics(tokenSnapshot({ p: 1, vol: 0.1 }))).toEqual({ dir: "flat", vol: "low" });
  });

  it("derives motifs and narrative hints deterministically", () => {
    expect(deriveMotifs("perp-liquidity")).toEqual(["temple", "wheel-of-liquidity", "pillar"]);
    expect(deriveMotifs("meme-ascendant")).toEqual(["crowd", "idol"]);
    expect(deriveMotifs("unknown")).toEqual(["unknown"]);

    const hints = deriveNarrativeHints("panic", { k: "collapse", i: 2 });
    expect(hints).toContain("mass exodus");
    expect(hints).toContain("foundation crumbling (intensity 2)");
  });
});
