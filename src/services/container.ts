import { logger } from "@/utils/logger";
import { createMarketCapService } from "@/services/market-cap";
import { createPromptService } from "@/services/prompt";
import { createStateService } from "@/services/state";
import { createGenerationService } from "@/services/generation";
import { createAutoResolveProvider } from "@/lib/providers";
import { createArchiveStorageService } from "@/services/archive-storage";
import { createArchiveIndexService } from "@/services/archive-index";
import { resolveBucketOrThrow } from "@/lib/r2";

/**
 * Create service container for Cloudflare Workers environment
 *
 * @param r2Bucket - Optional R2 bucket. If not provided, resolves from Cloudflare context
 * @param d1Binding - Optional D1 database binding. If not provided, resolves from Cloudflare context
 */
export function createServicesForWorkers(r2Bucket?: R2Bucket, d1Binding?: D1Database) {
  const bucket = resolveBucketOrThrow({ r2Bucket });

  const marketCapService = createMarketCapService({ fetch, log: logger });
  const promptService = createPromptService();
  const stateService = createStateService({ r2Bucket: bucket });
  const archiveStorageService = createArchiveStorageService({ r2Bucket: bucket });
  const archiveIndexService = createArchiveIndexService({ d1Binding });
  const imageProvider = createAutoResolveProvider();

  const generationService = createGenerationService({
    marketCapService,
    promptService,
    imageProvider,
    stateService,
    archiveStorageService,
    archiveIndexService,
    log: logger,
  });

  return {
    marketCapService,
    promptService,
    stateService,
    archiveStorageService,
    archiveIndexService,
    generationService,
    imageProvider,
  };
}

export type ServiceContainer = ReturnType<typeof createServicesForWorkers>;
