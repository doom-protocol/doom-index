import { err, ok, Result } from "neverthrow";
import { roundMc4 } from "@/lib/round";
import { hashRoundedMap } from "@/lib/pure/hash";
import { logger } from "@/utils/logger";
import { TOKEN_TICKERS, type McMap, type McMapRounded } from "@/constants/token";
import type { MarketCapService } from "@/services/market-cap";
import type { PromptService, PromptComposition } from "@/services/prompt";
import type {
  ImageProvider,
  StateService,
  RevenueEngine,
  TradeSnapshot,
  RevenueReport,
  TokenState,
} from "@/types/domain";
import type { AppError } from "@/types/app-error";

export type MinuteEvaluation = {
  status: "skipped" | "generated";
  hash: string;
  roundedMap: McMapRounded;
  imageUrl?: string;
  paramsHash?: string;
  seed?: string;
  revenue?: RevenueReport;
};

export type GenerationService = {
  evaluateMinute(): Promise<Result<MinuteEvaluation, AppError>>;
};

type GenerationDeps = {
  marketCapService: Pick<MarketCapService, "getMcMap">;
  promptService: PromptService;
  imageProvider: ImageProvider;
  stateService: StateService;
  revenueEngine: RevenueEngine;
  fetchTradeSnapshots?: () => Promise<TradeSnapshot[]>;
  generationRate?: number;
  log?: typeof logger;
};

const minuteBucketToIso = (minuteBucket: string): string => `${minuteBucket}:00Z`;

const createTokenStates = (imageUrl: string, minuteBucket: string): TokenState[] =>
  TOKEN_TICKERS.map(ticker => ({
    ticker,
    thumbnailUrl: imageUrl,
    updatedAt: minuteBucketToIso(minuteBucket),
  }));

export function createGenerationService({
  marketCapService,
  promptService,
  imageProvider,
  stateService,
  revenueEngine,
  fetchTradeSnapshots = async () => [],
  generationRate = 1,
  log = logger,
}: GenerationDeps): GenerationService {
  async function evaluateMinute(): Promise<Result<MinuteEvaluation, AppError>> {
    const mcResult = await marketCapService.getMcMap();
    if (mcResult.isErr()) return err(mcResult.error);

    const mcMap: McMap = mcResult.value;
    const roundedMap = roundMc4(mcMap) as McMapRounded;
    const hash = await hashRoundedMap(roundedMap);

    const globalStateResult = await stateService.readGlobalState();
    if (globalStateResult.isErr()) return err(globalStateResult.error);

    const prevState = globalStateResult.value;
    const prevHash = prevState?.prevHash ?? null;

    if (prevHash && prevHash === hash) {
      log.info("generation.skip", { hash, prevHash });
      return ok({
        status: "skipped" as const,
        hash,
        roundedMap,
      });
    }

    log.info("generation.trigger", { hash, prevHash });

    const promptResult = await promptService.composePrompt(roundedMap);
    if (promptResult.isErr()) return err(promptResult.error);
    const composition: PromptComposition = promptResult.value;

    const imageResult = await imageProvider.generate({
      prompt: composition.prompt.text,
      negative: composition.prompt.negative,
      width: composition.prompt.size.w,
      height: composition.prompt.size.h,
      format: composition.prompt.format,
      seed: composition.prompt.seed,
    });
    if (imageResult.isErr()) return err(imageResult.error);

    const storedImageResult = await stateService.storeImage(composition.prompt.filename, imageResult.value.imageBuffer);
    if (storedImageResult.isErr()) return err(storedImageResult.error);
    const imageUrl = storedImageResult.value;

    const revenueSnapshots = await fetchTradeSnapshots();
    const revenueCalculation = revenueEngine.calculateMinuteRevenue(revenueSnapshots, generationRate);
    let revenueReport: RevenueReport | undefined;
    if (revenueCalculation.isOk()) {
      revenueReport = revenueCalculation.value;
      const revenueWrite = await stateService.writeRevenue(revenueReport, composition.minuteBucket);
      if (revenueWrite.isErr()) return err(revenueWrite.error);
    } else {
      log.warn("generation.revenue.skip", { cause: revenueCalculation.error });
    }

    const globalWrite = await stateService.writeGlobalState({
      prevHash: hash,
      lastTs: minuteBucketToIso(composition.minuteBucket),
      imageUrl,
    });
    if (globalWrite.isErr()) return err(globalWrite.error);

    const tokenStatesResult = await stateService.writeTokenStates(
      createTokenStates(imageUrl, composition.minuteBucket),
    );
    if (tokenStatesResult.isErr()) return err(tokenStatesResult.error);

    log.info("generation.generated", { hash, imageUrl });

    return ok({
      status: "generated" as const,
      hash,
      roundedMap,
      imageUrl,
      paramsHash: composition.paramsHash,
      seed: composition.seed,
      revenue: revenueReport,
    });
  }

  return { evaluateMinute };
}
