import { logger } from "@/utils/logger";
import { createMarketCapService } from "@/services/market-cap";
import { createPromptService } from "@/services/prompt";
import { createStateService } from "@/services/state";
import { createGenerationService } from "@/services/generation";
import { createAutoResolveProvider } from "@/lib/providers";
import { createRevenueEngine } from "@/services/revenue";
import { createArchiveStorageService } from "@/services/archive-storage";
import { resolveBucketOrThrow } from "@/lib/r2";

/**
 * Create service container for Cloudflare Workers environment
 *
 * @param r2Bucket - Optional R2 bucket. If not provided, resolves from Cloudflare context
 */
export function createServicesForWorkers(r2Bucket?: R2Bucket) {
  const bucket = resolveBucketOrThrow({ r2Bucket });

  const marketCapService = createMarketCapService({ fetch, log: logger });
  const promptService = createPromptService();
  const stateService = createStateService({ r2Bucket: bucket });
  const archiveStorageService = createArchiveStorageService({ r2Bucket: bucket });
  // Provider automatically resolves based on model in ImageRequest
  const imageProvider = createAutoResolveProvider();
  const revenueEngine = createRevenueEngine();

  const fetchTradeSnapshots = async () => [];

  const generationService = createGenerationService({
    marketCapService,
    promptService,
    imageProvider,
    stateService,
    revenueEngine,
    archiveStorageService,
    fetchTradeSnapshots,
    log: logger,
  });

  return {
    marketCapService,
    promptService,
    stateService,
    archiveStorageService,
    generationService,
    imageProvider,
    revenueEngine,
  };
}

export type ServiceContainer = ReturnType<typeof createServicesForWorkers>;
