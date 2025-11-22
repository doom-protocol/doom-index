import { Result, ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { TokenDataFetchService } from "./token-data-fetch";
import { MarketDataService } from "./market-data";
import { ScoringEngine } from "./scoring-engine";
import { TokensRepository } from "@/repositories/tokens-repository";
import type { TokenCandidate, SelectedToken } from "@/types/paintings";
import type { MarketClimate } from "@/types/painting-context";
import { logger } from "@/utils/logger";

/**
 * Constants
 */
const STABLECOIN_SYMBOLS = ["USDT", "USDC", "BUSD", "DAI", "TUSD", "USDP", "USDD"] as const;
const STABLECOIN_SYMBOLS_SET = new Set<string>(STABLECOIN_SYMBOLS);

const MAX_FORCE_TOKEN_LIST_SIZE = 20;
const FORCE_TOKEN_PATTERN = /^[a-z0-9-]{1,64}$/i;

const DEFAULT_RECENT_SELECTION_WINDOW_HOURS = 24;
const MILLISECONDS_TO_SECONDS = 1000;
const FORCE_OVERRIDE_DUMMY_SCORE = 1.0;

// Market climate classification thresholds
const MARKET_CAP_CHANGE_EUPHORIA_THRESHOLD = 3;
const FEAR_GREED_EUPHORIA_THRESHOLD = 70;
const MARKET_CAP_CHANGE_COOLING_THRESHOLD = 0.5;
const MARKET_CAP_CHANGE_DESPAIR_THRESHOLD = -5;
const MARKET_CAP_CHANGE_PANIC_THRESHOLD = -1.5;

/**
 * Token Selection Options
 */
type TokenSelectionOptions = {
  forceTokenList?: string; // FORCE_TOKEN_LIST env var
  excludeRecentlySelected?: boolean; // Default: true
  recentSelectionWindowHours?: number; // Default: 24
};

/**
 * Token Selection Service
 * Selects top token from candidates using scoring logic
 * Requirements: 1B, 1D, 4, 9
 */
export class TokenSelectionService {
  private readonly scoringEngine: ScoringEngine;
  private readonly stablecoinSymbols = STABLECOIN_SYMBOLS_SET;
  private readonly maxForceTokenListSize = MAX_FORCE_TOKEN_LIST_SIZE;
  private readonly forceTokenPattern = FORCE_TOKEN_PATTERN;

  constructor(
    private readonly tokenDataFetchService: TokenDataFetchService,
    private readonly marketDataService: MarketDataService,
    private readonly tokensRepository: TokensRepository,
  ) {
    this.scoringEngine = new ScoringEngine();
  }

  /**
   * Select top token from candidates (Requirement 1D)
   */
  async selectToken(options: TokenSelectionOptions = {}): Promise<Result<SelectedToken, AppError>> {
    try {
      const {
        forceTokenList,
        excludeRecentlySelected = true,
        recentSelectionWindowHours = DEFAULT_RECENT_SELECTION_WINDOW_HOURS,
      } = options;

      // Fetch market data for mood score calculation
      const marketDataResult = await this.marketDataService.fetchGlobalMarketData();
      if (marketDataResult.isErr()) {
        return err(marketDataResult.error);
      }

      const marketSnapshot = marketDataResult.value;
      const marketClimate = this.classifyMarketClimate(marketSnapshot);

      // Get candidates based on source
      let candidates: TokenCandidate[];

      if (forceTokenList) {
        // Force override flow (Requirement 1B)
        logger.info(`[TokenSelectionService] Using FORCE_TOKEN_LIST: ${forceTokenList}`);
        const candidatesResult = await this.fetchForceOverrideTokens(forceTokenList);
        if (candidatesResult.isErr()) {
          return err(candidatesResult.error);
        }
        candidates = candidatesResult.value;
      } else {
        // Normal trending flow (Requirement 1A)
        const candidatesResult = await this.tokenDataFetchService.fetchTrendingTokens();
        if (candidatesResult.isErr()) {
          return err(candidatesResult.error);
        }
        candidates = candidatesResult.value;
      }

      if (candidates.length === 0) {
        return err({
          type: "ValidationError" as const,
          message: "No token candidates available",
        });
      }

      // Filter candidates
      if (!forceTokenList) {
        // Exclude stablecoins (Requirement 1D)
        candidates = candidates.filter(c => !this.stablecoinSymbols.has(c.symbol));
      }

      // Exclude recently selected tokens (Requirement 1D)
      if (excludeRecentlySelected && !forceTokenList) {
        const recentTokensResult = await this.tokensRepository.findRecentlySelected(recentSelectionWindowHours);
        if (recentTokensResult.isOk()) {
          const recentIds = new Set(recentTokensResult.value.map(t => t.id));
          const beforeFilter = candidates.length;
          candidates = candidates.filter(c => !recentIds.has(c.id));
          if (candidates.length < beforeFilter) {
            logger.info(
              `[TokenSelectionService] Excluded ${beforeFilter - candidates.length} recently selected tokens`,
            );
          }
        }
      }

      if (candidates.length === 0) {
        return err({
          type: "ValidationError" as const,
          message: "No token candidates available after filtering",
        });
      }

      // Select token
      let selected: TokenCandidate;

      if (forceTokenList) {
        // Force override: select by priority (Requirement 1B)
        candidates.sort((a, b) => (a.forcePriority || 0) - (b.forcePriority || 0));
        selected = candidates[0];
        logger.info(
          `[TokenSelectionService] Selected token from force override: ${selected.id} (priority: ${selected.forcePriority})`,
        );
      } else {
        // Normal flow: score and select (Requirement 1D)
        const scoredCandidates = candidates.map(candidate => {
          const trendScore = this.scoringEngine.calculateTrendScore(candidate);
          const impactScore = this.scoringEngine.calculateImpactScore(candidate);
          const moodScore = this.scoringEngine.calculateMoodScore(candidate, marketClimate);
          const finalScore = this.scoringEngine.calculateFinalScore({
            trend: trendScore,
            impact: impactScore,
            mood: moodScore,
          });

          return {
            candidate,
            scores: {
              trend: trendScore,
              impact: impactScore,
              mood: moodScore,
              final: finalScore,
            },
          };
        });

        // Sort by final score descending
        scoredCandidates.sort((a, b) => b.scores.final - a.scores.final);

        selected = scoredCandidates[0].candidate;

        logger.info(
          `[TokenSelectionService] Selected token: ${selected.id} (finalScore: ${scoredCandidates[0].scores.final.toFixed(3)})`,
        );

        // Store token metadata
        await this.storeTokenMetadata(selected);

        // Return selected token with scores
        return ok(this.buildSelectedToken(selected, scoredCandidates[0].scores));
      }

      // Store token metadata for force override
      await this.storeTokenMetadata(selected);

      // For force override, return with dummy scores
      const dummyScores = {
        trend: FORCE_OVERRIDE_DUMMY_SCORE,
        impact: FORCE_OVERRIDE_DUMMY_SCORE,
        mood: FORCE_OVERRIDE_DUMMY_SCORE,
        final: FORCE_OVERRIDE_DUMMY_SCORE,
      };

      return ok(this.buildSelectedToken(selected, dummyScores));
    } catch (error) {
      logger.error("[TokenSelectionService] Failed to select token", { error });
      return err({
        type: "InternalError" as const,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Fetch tokens from force override list (Requirement 1B)
   */
  private async fetchForceOverrideTokens(forceTokenList: string): Promise<Result<TokenCandidate[], AppError>> {
    const { tickers, invalidEntries, truncated } = this.parseForceTokenList(forceTokenList);

    if (invalidEntries.length > 0) {
      logger.warn("[TokenSelectionService] Skipped invalid FORCE_TOKEN_LIST entries", {
        invalidEntries,
      });
    }

    if (truncated) {
      logger.warn("[TokenSelectionService] FORCE_TOKEN_LIST truncated to limit", {
        limit: this.maxForceTokenListSize,
      });
    }

    if (tickers.length === 0) {
      return err({
        type: "ValidationError" as const,
        message: "No valid tickers found in FORCE_TOKEN_LIST",
      });
    }

    logger.info(`[TokenSelectionService] Resolving ${tickers.length} tickers from FORCE_TOKEN_LIST`);

    // Resolve tickers to CoinGecko IDs
    const resolveResult = await this.tokenDataFetchService.resolveTickersToIds(tickers);
    if (resolveResult.isErr()) {
      return err(resolveResult.error);
    }

    const resolved = resolveResult.value;
    const ids = resolved.map(r => r.id);

    // Fetch token details
    const candidatesResult = await this.tokenDataFetchService.fetchTokenDetails(ids, "force-override", undefined);

    if (candidatesResult.isErr()) {
      return err(candidatesResult.error);
    }

    // Add force priority
    const candidates = candidatesResult.value.map((candidate, index) => ({
      ...candidate,
      forcePriority: index,
    }));

    logger.info(`[TokenSelectionService] Fetched ${candidates.length} tokens from FORCE_TOKEN_LIST`);
    return ok(candidates);
  }

  /**
   * Store token metadata to D1 (Requirement 9)
   */
  private async storeTokenMetadata(candidate: TokenCandidate): Promise<void> {
    const now = Math.floor(Date.now() / MILLISECONDS_TO_SECONDS);

    const tokenResult = await this.tokensRepository.findById(candidate.id);

    if (tokenResult.isErr()) {
      logger.error("[TokenSelectionService] Failed to check existing token", {
        operation: "storeTokenMetadata",
        candidateId: candidate.id,
        error: tokenResult.error,
      });
      throw new Error(`Failed to check existing token for ${candidate.id}: ${tokenResult.error.message}`);
    }

    const existingToken = tokenResult.value;

    if (existingToken === null) {
      // Insert new token
      await this.tokensRepository.insert({
        id: candidate.id,
        symbol: candidate.symbol,
        name: candidate.name,
        coingeckoId: candidate.id,
        logoUrl: candidate.logoUrl,
        categories: JSON.stringify(candidate.categories),
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Update existing token
      await this.tokensRepository.update(candidate.id, {
        updatedAt: now,
      });
    }
  }

  /**
   * Classify market climate (simplified version, will be moved to classification functions)
   */
  private classifyMarketClimate(snapshot: {
    marketCapChangePercentage24hUsd: number;
    fearGreedIndex: number | null;
  }): MarketClimate {
    const mc = snapshot.marketCapChangePercentage24hUsd;
    const fg = snapshot.fearGreedIndex;

    if (mc > MARKET_CAP_CHANGE_EUPHORIA_THRESHOLD && fg !== null && fg >= FEAR_GREED_EUPHORIA_THRESHOLD) {
      return "euphoria";
    } else if (mc > MARKET_CAP_CHANGE_COOLING_THRESHOLD) {
      return "cooling";
    } else if (mc < MARKET_CAP_CHANGE_DESPAIR_THRESHOLD) {
      return "despair";
    } else if (mc < MARKET_CAP_CHANGE_PANIC_THRESHOLD) {
      return "panic";
    } else {
      return "transition";
    }
  }

  /**
   * Build SelectedToken from candidate and scores
   */
  private buildSelectedToken(candidate: TokenCandidate, scores: SelectedToken["scores"]): SelectedToken {
    return {
      id: candidate.id,
      symbol: candidate.symbol,
      name: candidate.name,
      logoUrl: candidate.logoUrl,
      priceUsd: candidate.priceUsd,
      priceChange24h: candidate.priceChange24h,
      priceChange7d: candidate.priceChange7d,
      volume24hUsd: candidate.volume24hUsd,
      marketCapUsd: candidate.marketCapUsd,
      categories: candidate.categories,
      source: candidate.source,
      scores,
    };
  }

  /**
   * Parse and sanitize FORCE_TOKEN_LIST input
   */
  private parseForceTokenList(forceTokenList: string): {
    tickers: string[];
    invalidEntries: string[];
    truncated: boolean;
  } {
    const rawTickers = forceTokenList
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const seen = new Set<string>();
    const tickers: string[] = [];
    const invalidEntries: string[] = [];
    let truncated = false;

    for (const ticker of rawTickers) {
      if (!this.forceTokenPattern.test(ticker)) {
        invalidEntries.push(ticker);
        continue;
      }

      const normalized = ticker.toLowerCase();
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);

      if (tickers.length >= this.maxForceTokenListSize) {
        truncated = true;
        continue;
      }

      tickers.push(normalized);
    }

    return { tickers, invalidEntries, truncated };
  }
}
