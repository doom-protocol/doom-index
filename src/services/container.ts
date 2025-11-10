import { logger } from "@/utils/logger";
import { createMarketCapService } from "@/services/market-cap";
import { createPromptService } from "@/services/prompt";
import { createStateService } from "@/services/state";
import { createGenerationService } from "@/services/generation";
import { createMemoryR2Client } from "@/lib/r2";
import { resolveProvider } from "@/lib/providers";
import { createRevenueEngine } from "@/services/revenue";

/**
 * Cloudflare Workers 環境用のサービスコンテナを作成
 */
export function createServicesForWorkers(r2Bucket: R2Bucket, r2PublicDomain: string, providerApiKey: string) {
  const marketCapService = createMarketCapService({ fetch, log: logger });
  const promptService = createPromptService();
  const stateService = createStateService({ r2Bucket, r2PublicDomain });
  const imageProvider = resolveProvider("smart"); // TODO: 環境変数から取得
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
 * Next.js 環境用のサービスコンテナ（読み取り専用）
 * R2 公開 URL 経由でアクセス
 */
export function createServicesForNextjs(r2PublicDomain: string) {
  // Next.js では R2 Binding が使えないため、メモリクライアントを使用
  // 実際の読み取りは getJsonFromPublicUrl を直接使用
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
