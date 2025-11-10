import { logger } from "@/utils/logger";
import { createMarketCapService } from "@/services/market-cap";
import { createPromptService } from "@/services/prompt";
import { createStateService } from "@/services/state";
import { createGenerationService } from "@/services/generation";
import { createMemoryR2Client } from "@/lib/r2";
import { resolveProvider } from "@/lib/providers";
import { createRevenueEngine } from "@/services/revenue";

/**
 * Create service container for Cloudflare Workers environment
 */
export function createServicesForWorkers(r2Bucket: R2Bucket, r2PublicDomain: string) {
  const marketCapService = createMarketCapService({ fetch, log: logger });
  const promptService = createPromptService();
  const stateService = createStateService({ r2Bucket, r2PublicDomain });
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

/**
 * Create service container for Next.js environment (read-only)
 * Access via R2 public URL
 */
export function createServicesForNextjs(r2PublicDomain: string) {
  // Use memory client since R2 Binding is not available in Next.js
  // Actual reads use getJsonFromPublicUrl directly
  const { bucket } = createMemoryR2Client(r2PublicDomain);

  const marketCapService = createMarketCapService({ fetch, log: logger });
  const stateService = createStateService({ r2Bucket: bucket, r2PublicDomain });

  return {
    marketCapService,
    stateService,
  };
}

export type ServiceContainer = ReturnType<typeof createServicesForWorkers>;
export type NextjsServiceContainer = ReturnType<typeof createServicesForNextjs>;
