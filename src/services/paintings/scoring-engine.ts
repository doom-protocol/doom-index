import type { MarketClimate } from "@/types/painting-context";
import type { TokenCandidate } from "@/types/paintings";

/**
 * Scoring Engine
 * Calculates scores for token candidates
 * Requirement 1D
 */
export class ScoringEngine {
  /**
   * Calculate trend score (Requirement 1D)
   * Based on CoinGecko Trending Search rank and 24h volume
   */
  calculateTrendScore(candidate: TokenCandidate): number {
    // Trend score components:
    // - CoinGecko Trending Search rank (0.80 weight)
    // - 24h volume (0.20 weight)
    // Adjusted to favor actual user search interest over raw volume (which favors BTC)

    let rankScore = 0;
    if (candidate.trendingRankCgSearch !== undefined) {
      // Higher rank (lower number) = higher score
      // Normalize: rank 1 = 1.0, rank 15 = 0.0
      rankScore = Math.max(0, 1 - (candidate.trendingRankCgSearch - 1) / 14);
    }

    // Volume score: normalize volume to 0-1 range
    // Using log scale to handle wide range of volumes
    const maxVolume = 10000000000; // 10B USD as reference
    const volumeScore = Math.min(1, Math.log10(Math.max(1, candidate.volume24hUsd)) / Math.log10(maxVolume));

    return 0.8 * rankScore + 0.2 * volumeScore;
  }

  /**
   * Calculate impact score (Requirement 1D)
   * Based on price change, market cap, volume, and token archetype
   */
  calculateImpactScore(candidate: TokenCandidate): number {
    // Impact score components:
    // - Price change magnitude (Max of 24h and 7d to capture both new launches and sustained trends)
    // - Turnover (Volume / Market Cap) - captures active trading interest relative to size
    // - Market cap - reduced weight to prevent bias towards inactive mega-caps
    // - Token archetype weight

    // Price change magnitude (0-1)
    // Adjusted to be more sensitive to recent moves (24h) while respecting weekly trends (7d)
    const change24h = Math.abs(candidate.priceChange24h);
    const change7d = Math.abs(candidate.priceChange7d ?? 0);

    const score24h = Math.min(1, change24h / 30); // 30% move in 24h is max score
    const score7d = Math.min(1, change7d / 60); // 60% move in 7d is max score

    // Use the stronger signal between 24h and 7d
    const priceChangeMagnitude = Math.max(score24h, score7d);

    // Turnover score: measures trading activity relative to capitalization
    // Helps identify tokens that are "in play" regardless of size (e.g. new L1s, memes)
    // BTC usually has lower turnover than trending alts
    // Normalized: 50% turnover = 1.0 score
    const turnover = candidate.volume24hUsd / Math.max(1, candidate.marketCapUsd);
    const turnoverScore = Math.min(1, turnover * 2);

    // Market cap score (log scale)
    const maxMarketCap = 1000000000000; // 1T USD as reference
    const marketCapScore = Math.min(1, Math.log10(Math.max(1, candidate.marketCapUsd)) / Math.log10(maxMarketCap));

    // Archetype weight (based on categories)
    let archetypeWeight = 0.5; // Default
    if (candidate.categories.includes("l1") || candidate.categories.includes("layer-1")) {
      archetypeWeight = 1.0; // L1 tokens have high impact
    } else if (candidate.categories.includes("meme")) {
      archetypeWeight = 0.3; // Meme tokens have lower structural impact
    } else if (candidate.categories.includes("defi") || candidate.categories.includes("DeFi")) {
      archetypeWeight = 0.7;
    }

    // Combine components
    // Formula: Price(60%) + Turnover(30%) + Size(10%)
    // Heavily favors price action and relative activity over raw size
    const impactScore = (priceChangeMagnitude * 0.6 + turnoverScore * 0.3 + marketCapScore * 0.1) * archetypeWeight;

    return Math.min(1, impactScore);
  }

  /**
   * Calculate mood score (Requirement 1D)
   * Based on Market Climate and token price change alignment
   */
  calculateMoodScore(candidate: TokenCandidate, marketClimate: MarketClimate): number {
    // Mood score: how well the token's price change aligns with market mood
    // Examples:
    // - Euphoria + major rally = high mood score
    // - Panic + major collapse = high mood score
    // - Euphoria + collapse = low mood score

    const priceChange = candidate.priceChange24h;

    switch (marketClimate) {
      case "euphoria":
        // Euphoria: positive price changes are aligned
        if (priceChange > 5) {
          return 1.0; // Major rally in euphoria
        } else if (priceChange > 0) {
          return 0.7; // Positive movement
        } else if (priceChange > -5) {
          return 0.3; // Slight negative
        } else {
          return 0.0; // Major collapse in euphoria = misaligned
        }

      case "panic":
      case "despair":
        // Panic/Despair: negative price changes are aligned
        if (priceChange < -5) {
          return 1.0; // Major collapse in panic
        } else if (priceChange < 0) {
          return 0.7; // Negative movement
        } else if (priceChange < 5) {
          return 0.3; // Slight positive
        } else {
          return 0.0; // Major rally in panic = misaligned
        }

      case "cooling":
      case "transition":
        // Cooling/Transition: moderate movements are aligned
        if (Math.abs(priceChange) < 3) {
          return 0.8; // Stable movement
        } else if (Math.abs(priceChange) < 10) {
          return 0.5; // Moderate movement
        } else {
          return 0.2; // Extreme movement = less aligned
        }

      default:
        return 0.5; // Unknown climate = neutral
    }
  }

  /**
   * Calculate final score (Requirement 1D)
   * finalScore = 0.50 * trend + 0.35 * impact + 0.15 * mood
   */
  calculateFinalScore(scores: { trend: number; impact: number; mood: number }): number {
    return 0.5 * scores.trend + 0.35 * scores.impact + 0.15 * scores.mood;
  }
}
