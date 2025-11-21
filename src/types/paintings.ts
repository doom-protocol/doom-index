/**
 * Types for dynamic-draw painting generation
 */
import type { VisualParams } from "@/lib/pure/mapping";

/**
 * Base token data shared between candidate and selected tokens
 */
export type TokenBase = {
  id: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  priceUsd: number;
  priceChange24h: number;
  priceChange7d: number;
  volume24hUsd: number;
  marketCapUsd: number;
  categories: string[];
  source: "coingecko-trending-search" | "force-override";
};

/**
 * Token Candidate - candidate token for selection
 * Requirement 1C, 1D
 */
export type TokenCandidate = TokenBase & {
  trendingRankCgSearch?: number;
  forcePriority?: number;
};

/**
 * Selected Token - token selected for painting generation
 * Requirement 1D
 */
export type SelectedToken = TokenBase & {
  scores: {
    trend: number;
    impact: number;
    mood: number;
    final: number;
  };
};

/**
 * Market Snapshot - global market data snapshot
 * Requirement 3
 */
export type MarketSnapshot = {
  totalMarketCapUsd: number;
  totalVolumeUsd: number;
  marketCapChangePercentage24hUsd: number;
  btcDominance: number;
  ethDominance: number;
  activeCryptocurrencies: number;
  markets: number;
  fearGreedIndex: number | null; // 0-100, from Alternative.me
  updatedAt: number; // Unix epoch seconds from CoinGecko
};

/**
 * Token Snapshot - token market data snapshot
 * Requirement 2
 */
export type TokenSnapshot = {
  p: number; // priceChange24h
  p7: number; // priceChange7d
  v: number; // volume24hUsd
  mc: number; // marketCapUsd
  vol: number; // volatilityScore (0-1)
};

/**
 * Painting metadata stored in archive
 */
export type PaintingMetadata = {
  id: string;
  timestamp: string;
  minuteBucket: string;
  paramsHash: string;
  seed: string;
  imageUrl: string;
  fileSize: number;
  visualParams: VisualParams;
  prompt: string;
  negative: string;
};

/**
 * Painting record returned via APIs/listing
 */
export type Painting = PaintingMetadata;

export type DatePrefix = {
  year: string;
  month: string;
  day: string;
  prefix: string;
};
