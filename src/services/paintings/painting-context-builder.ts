import { Result, ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { TokensRepository } from "@/repositories/tokens-repository";
import type { SelectedToken, MarketSnapshot, TokenSnapshot } from "@/types/paintings";
import type { PaintingContext } from "@/types/painting-context";
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
import { logger } from "@/utils/logger";

/**
 * Painting Context Input
 */
type PaintingContextInput = {
  selectedToken: SelectedToken;
  marketSnapshot: MarketSnapshot;
};

/**
 * Painting Context Builder
 * Builds PaintingContext from selected token and market data
 * Requirement 5
 */
export class PaintingContextBuilder {
  constructor(private readonly tokensRepository: TokensRepository) {}

  /**
   * Build PaintingContext from selected token and market data (Requirement 5)
   */
  async buildContext(input: PaintingContextInput): Promise<Result<PaintingContext, AppError>> {
    try {
      const { selectedToken, marketSnapshot } = input;

      logger.debug(`[PaintingContextBuilder] Building context for token: ${selectedToken.id}`);

      // Get token metadata from DB
      const tokenResult = await this.tokensRepository.findById(selectedToken.id);
      let categories: string[] = selectedToken.categories;

      if (tokenResult.isOk() && tokenResult.value) {
        try {
          categories = JSON.parse(tokenResult.value.categories) as string[];
        } catch {
          // If parsing fails, use categories from selectedToken
          categories = selectedToken.categories;
        }
      }

      // Calculate volatility score from price changes
      // Formula: (|priceChange24h| + |priceChange7d| / 7) / 50, clamped to [0, 1]
      // - Asymmetric weighting: 24h change has full weight, 7d change is averaged (÷7) to prevent over-weighting
      // - Division by 50 maps typical percent changes (0-50%+) into 0-1 range for classification
      // - Thresholds: 0.33 → "low", 0.33-0.66 → "medium", 0.66+ → "high" volatility
      const volatilityScore = Math.min(
        1,
        (Math.abs(selectedToken.priceChange24h) + Math.abs(selectedToken.priceChange7d) / 7) / 50,
      );

      // Build token snapshot
      const tokenSnapshot: TokenSnapshot = {
        p: selectedToken.priceChange24h,
        p7: selectedToken.priceChange7d,
        v: selectedToken.volume24hUsd,
        mc: selectedToken.marketCapUsd,
        vol: volatilityScore,
      };

      // Classify all components
      const climate = classifyMarketClimate(marketSnapshot);
      const archetype = classifyTokenArchetype(selectedToken, categories);
      const event = classifyEventPressure(tokenSnapshot);
      const composition = pickComposition(climate, archetype, event);
      const palette = pickPalette(climate, archetype, event);
      const dynamics = classifyDynamics(tokenSnapshot);
      const motifs = deriveMotifs(archetype);
      const narrativeHints = deriveNarrativeHints(climate, event);

      // Build PaintingContext
      const context: PaintingContext = {
        t: {
          n: selectedToken.name,
          c: "solana", // Default chain, can be enhanced later
        },
        m: {
          mc: marketSnapshot.marketCapChangePercentage24hUsd,
          bd: marketSnapshot.btcDominance,
          fg: marketSnapshot.fearGreedIndex,
        },
        s: tokenSnapshot,
        c: climate,
        a: archetype,
        e: event,
        o: composition,
        p: palette,
        d: dynamics,
        f: motifs,
        h: narrativeHints,
      };

      logger.info(
        `[PaintingContextBuilder] Built context: climate=${climate}, archetype=${archetype}, event=${event.k}`,
      );
      return ok(context);
    } catch (error) {
      logger.error("[PaintingContextBuilder] Failed to build context", { error });
      return err({
        type: "InternalError" as const,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
