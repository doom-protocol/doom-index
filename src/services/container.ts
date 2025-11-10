import { logger } from "@/utils/logger";
import { createMarketCapService } from "@/services/market-cap";
import { createPromptService } from "@/services/prompt";
import { createStateService } from "@/services/state";
import { createGenerationService } from "@/services/generation";
import { createMemoryBlobClient, createVercelBlobClient } from "@/lib/blob-client";
import { resolveProvider } from "@/lib/providers";
import { createRevenueEngine } from "@/services/revenue";
import { env } from "@/env";

const blobClient =
  env.NODE_ENV === "production" && env.BLOB_READ_WRITE_TOKEN
    ? createVercelBlobClient(env.BLOB_READ_WRITE_TOKEN)
    : createMemoryBlobClient();

const marketCapService = createMarketCapService({ fetch, log: logger });
const promptService = createPromptService();
const stateService = createStateService({ blobClient });
const imageProvider = resolveProvider(env.IMAGE_PROVIDER);
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

export const services = {
  marketCapService,
  promptService,
  stateService,
  generationService,
  imageProvider,
  revenueEngine,
};

export type ServiceContainer = typeof services;

export const getServices = (): ServiceContainer => services;
