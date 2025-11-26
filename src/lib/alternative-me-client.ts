import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import { type Result, err, ok } from "neverthrow";

/**
 * Fear & Greed Index Response
 */
type FearGreedIndexResponse = {
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
  private readonly timeoutMs: number;

  constructor(timeoutMs = 10_000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Get latest Fear & Greed Index (Requirement 3)
   */
  async getFearGreedIndex(): Promise<Result<FearGreedIndexResponse, AppError>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      logger.debug("[AlternativeMeClient] Fetching Fear & Greed Index");

      const response = await fetch(this.apiUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
      clearTimeout(timeoutId);

      // Handle abort/timeout errors
      if (error instanceof Error && error.name === "AbortError") {
        logger.error(`[AlternativeMeClient] Request timed out after ${this.timeoutMs}ms`);
        return err({
          type: "TimeoutError" as const,
          message: `Alternative.me API request timed out after ${this.timeoutMs}ms`,
          timeoutMs: this.timeoutMs,
        });
      }

      logger.error("[AlternativeMeClient] Failed to fetch Fear & Greed Index", { error });
      return err({
        type: "ExternalApiError" as const,
        provider: "alternative.me",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
