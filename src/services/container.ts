import { logger } from "@/utils/logger";
import { createMarketCapService } from "@/services/market-cap";
import { createPromptService } from "@/services/prompt";
import { createStateService } from "@/services/state";
import { createGenerationService } from "@/services/generation";
import { resolveProvider } from "@/lib/providers";
import { createRevenueEngine } from "@/services/revenue";
import { resolveR2Bucket } from "@/lib/r2";

/**
 * Create service container for Cloudflare Workers environment
 *
 * @param r2Bucket - Optional R2 bucket. If not provided, resolves from Cloudflare context
 */
export function createServicesForWorkers(r2Bucket?: R2Bucket) {
  let bucket: R2Bucket;
  if (r2Bucket) {
    bucket = r2Bucket;
  } else {
    const bucketResult = resolveR2Bucket();
    if (bucketResult.isErr()) {
      throw new Error(`Failed to resolve R2 bucket: ${bucketResult.error.message}`);
    }
    bucket = bucketResult.value;
  }

  const marketCapService = createMarketCapService({ fetch, log: logger });
  const promptService = createPromptService();
  const stateService = createStateService({ r2Bucket: bucket });
  const imageProvider = resolveProvider("smart"); // TODO: Get from environment variable
  const revenueEngine = createRevenueEngine();

  const fetchTradeSnapshots = async () => [];

  const generationService = createGenerationService({
    marketCapService,
    promptService,
    imageProvider,
    stateService,
    revenueEngine,
    fetchTradeSnapshots,
    log: logger,
  });

  return {
    marketCapService,
    promptService,
    stateService,
    generationService,
    imageProvider,
    revenueEngine,
  };
}

export type ServiceContainer = ReturnType<typeof createServicesForWorkers>;
