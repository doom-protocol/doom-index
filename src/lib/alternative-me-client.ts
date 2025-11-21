import { Result, ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";

/**
 * Fear & Greed Index Response
 */
export type FearGreedIndexResponse = {
  value: number; // 0-100
  valueClassification: "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed";
  timestamp: number; // Unix epoch seconds
};

/**
 * Alternative.me API Response
 */
type AlternativeMeApiResponse = {
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
  }>;
};

/**
 * Alternative.me Fear & Greed Index Client
 * Anti-Corruption Layer for Alternative.me API
 */
export class AlternativeMeClient {
  private readonly apiUrl = "https://api.alternative.me/fng/";

  /**
   * Get latest Fear & Greed Index (Requirement 3)
   */
  async getFearGreedIndex(): Promise<Result<FearGreedIndexResponse, AppError>> {
    try {
      logger.debug("[AlternativeMeClient] Fetching Fear & Greed Index");

      const response = await fetch(this.apiUrl);

      if (!response.ok) {
        logger.error(`[AlternativeMeClient] API returned status ${response.status}`);
        return err({
          type: "ExternalApiError" as const,
          provider: "alternative.me",
          status: response.status,
          message: `Alternative.me API returned status ${response.status}`,
        });
      }

      const data = (await response.json()) as AlternativeMeApiResponse;

      if (!data.data || data.data.length === 0) {
        logger.error("[AlternativeMeClient] Invalid response from Alternative.me API");
        return err({
          type: "ExternalApiError" as const,
          provider: "alternative.me",
          message: "Invalid response from Alternative.me API",
        });
      }

      const latest = data.data[0];
      const value = Number.parseInt(latest.value, 10);
      const timestamp = Number.parseInt(latest.timestamp, 10);

      if (Number.isNaN(value) || Number.isNaN(timestamp)) {
        logger.error("[AlternativeMeClient] Failed to parse Fear & Greed Index data");
        return err({
          type: "ExternalApiError" as const,
          provider: "alternative.me",
          message: "Failed to parse Fear & Greed Index data",
        });
      }

      const result: FearGreedIndexResponse = {
        value,
        valueClassification: latest.value_classification as FearGreedIndexResponse["valueClassification"],
        timestamp,
      };

      logger.info(`[AlternativeMeClient] Fetched Fear & Greed Index: ${value} (${result.valueClassification})`);
      return ok(result);
    } catch (error) {
      logger.error("[AlternativeMeClient] Failed to fetch Fear & Greed Index", { error });
      return err({
        type: "ExternalApiError" as const,
        provider: "alternative.me",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
