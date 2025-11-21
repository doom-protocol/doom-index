import { err, ok, Result } from "neverthrow";
import { normalizeMcMap } from "@/lib/pure/normalize";
import { mapToVisualParams, type VisualParams } from "@/lib/pure/mapping";
import { hashVisualParams, seedForMinute, buildGenerationFileName } from "@/lib/pure/hash";
import { WORLD_PAINTING_NEGATIVE_PROMPT } from "@/constants/prompts/world-painting";
import { getMinuteBucket } from "@/utils/time";
import { logger } from "@/utils/logger";
import type { AppError } from "@/types/app-error";
import type { PaintingContext } from "@/types/painting-context";
import type { TokenContextService, TokenContext, TokenMetaInput } from "@/services/token-context-service";
import { FALLBACK_SHORT_CONTEXT } from "@/services/token-context-service";
import type { WorkersAiClient } from "@/lib/workers-ai-client";
import type { TokensRepository } from "@/repositories/tokens-repository";

export type PromptComposition = {
  seed: string;
  minuteBucket: string;
  vp: VisualParams;
  prompt: {
    text: string;
    negative: string;
    size: { w: number; h: number };
    format: "webp";
    seed: string;
    filename: string;
  };
  paramsHash: string;
};

export type TokenPromptRequest = {
  paintingContext: PaintingContext;
  tokenMeta?: TokenMetaInput;
  tokenContext?: TokenContext;
};

type WorldPromptServiceDeps = {
  tokenContextService?: TokenContextService;
  tokensRepository?: TokensRepository;
  workersAiClient?: WorkersAiClient;
  getMinuteBucket?: () => string;
  log?: typeof logger;
};

export type WorldPromptService = {
  composeTokenPrompt(request: TokenPromptRequest): Promise<Result<PromptComposition, AppError>>;
};

/**
 * World Prompt Service
 *
 * Generates FLUX-optimized prompts for market-wide allegorical paintings based on market capitalization.
 * This service creates the "world view" painting that represents the entire crypto market state.
 *
 * Flow:
 * - Market Cap → VisualParams normalization
 * - VisualParams → Hash, seed, and filename determination
 * - World painting prompt composition using weighted-prompt
 *
 * @see https://docs.bfl.ai/guides/prompting_summary
 */
const DEFAULT_IMAGE_SIZE = { w: 1024, h: 1024 } as const;

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function createWorldPromptService({
  tokenContextService,
  tokensRepository,
  workersAiClient,
  getMinuteBucket: minuteBucketFn = () => getMinuteBucket(),
  log = logger,
}: WorldPromptServiceDeps = {}): WorldPromptService {
  const buildPromptMetadata = async () => {
    // Legacy mcRounded system is deprecated - use default visual params
    const normalized = normalizeMcMap({});
    const vp = mapToVisualParams(normalized);
    const paramsHash = await hashVisualParams(vp);
    const minuteBucket = minuteBucketFn();
    const seed = await seedForMinute(minuteBucket, paramsHash);
    const filename = buildGenerationFileName(minuteBucket, paramsHash, seed);

    return { vp, paramsHash, minuteBucket, seed, filename };
  };

  const summarizeVisualParams = (vp: VisualParams): string => {
    return Object.entries(vp)
      .map(([key, value]) => `- ${key}: ${numberFormatter.format(value)}`)
      .join("\n");
  };

  const buildTokenSystemPrompt = (): string => {
    return `You are an AI art director specializing in FLUX image generation for DOOM INDEX, a generative art project that visualizes cryptocurrency market dynamics as allegorical paintings.

Follow FLUX prompting best practices:
- Use the "Subject + Action + Style + Context" framework
- Front-load the most important elements
- Use natural language for symbolic relationships
- Provide direct specifications for composition, palette, lighting, and atmosphere
- Focus on what should appear (avoid negations)
- Aim for 80-180 words for optimal FLUX steering

Your goal is to synthesize the provided token narrative, market state, and visual directives into a cohesive, cinematic FLUX prompt. Respond with the prompt text only. Do not include markdown, bullet points, headings, or commentary.`;
  };

  const buildTokenUserPrompt = (
    ctx: PaintingContext,
    tokenCtx: TokenContext,
    vp: VisualParams,
    shortContext: string,
  ): string => {
    const motifLine = ctx.f.length ? ctx.f.join(", ") : "none";
    const hintsLine = ctx.h.length ? ctx.h.join(", ") : "none";
    const tagLine = tokenCtx.tags.length ? tokenCtx.tags.join(", ") : "none";

    return [
      `Token Context:`,
      `- Name: ${ctx.t.n}`,
      `- Chain: ${ctx.t.c}`,
      `- Short Narrative: ${shortContext}`,
      `- Category: ${tokenCtx.category}`,
      `- Symbolic Tags: ${tagLine}`,
      ``,
      `Market Dynamics:`,
      `- Market Climate: ${ctx.c}`,
      `- Token Archetype: ${ctx.a}`,
      `- Event: ${ctx.e.k} (${ctx.e.i} intensity)`,
      `- Trend Direction: ${ctx.d.dir} (${ctx.d.vol} volatility)`,
      `- Global Market Snapshot:`,
      `  - Total MC: ${integerFormatter.format(ctx.m.mc)} USD`,
      `  - Dominance baseline: ${integerFormatter.format(ctx.m.bd)} USD`,
      `  - Flight-to-quality: ${ctx.m.fg === null ? "unknown" : `${integerFormatter.format(ctx.m.fg)} USD`}`,
      `- Token Metrics:`,
      `  - Price: ${numberFormatter.format(ctx.s.p)} USD`,
      `  - 7d Anchor: ${numberFormatter.format(ctx.s.p7)} USD`,
      `  - Market Cap: ${integerFormatter.format(ctx.s.mc)} USD`,
      `  - Volume: ${integerFormatter.format(ctx.s.v)} USD`,
      `  - Volatility Index: ${integerFormatter.format(ctx.s.vol)}`,
      ``,
      `Visual Directives:`,
      `- Composition: ${ctx.o}`,
      `- Palette: ${ctx.p}`,
      `- Motifs: ${motifLine}`,
      `- Narrative Hints: ${hintsLine}`,
      ``,
      `Market Map Derived Controls:`,
      summarizeVisualParams(vp),
      ``,
      `Instructions:`,
      `Describe a single cohesive FLUX-ready painting capturing the token's emotional arc, market tension, and symbolic motifs. Keep the prose flowing, cinematic, and evocative. Reference composition, palette, atmosphere, and key symbolism explicitly.`,
    ].join("\n");
  };

  const resolveTokenContext = async (request: TokenPromptRequest): Promise<Result<TokenContext, AppError>> => {
    if (request.tokenContext) return ok(request.tokenContext);

    if (!tokenContextService) {
      return err({
        type: "ConfigurationError",
        message: "tokenContextService is required when tokenContext is not provided",
      });
    }

    if (!request.tokenMeta) {
      return err({
        type: "ValidationError",
        message: "tokenMeta is required when tokenContext is not provided",
      });
    }

    return tokenContextService.generateTokenContext(request.tokenMeta);
  };

  async function composeTokenPrompt(request: TokenPromptRequest): Promise<Result<PromptComposition, AppError>> {
    if (!workersAiClient) {
      return err({
        type: "ConfigurationError",
        message: "workersAiClient is required for token prompt generation",
        missingVar: "AI",
      });
    }

    try {
      const { paintingContext } = request;
      const { vp, paramsHash, minuteBucket, seed, filename } = await buildPromptMetadata();

      log.debug("prompt.compose.token.start", {
        tokenName: paintingContext.t.n,
        chain: paintingContext.t.c,
        hasTokenMeta: Boolean(request.tokenMeta),
        providedTokenContext: Boolean(request.tokenContext),
      });

      const tokenContextResult = await resolveTokenContext(request);
      if (tokenContextResult.isErr()) {
        log.error("prompt.compose.token.context.error", {
          tokenName: paintingContext.t.n,
          chain: paintingContext.t.c,
          errorType: tokenContextResult.error.type,
          message: tokenContextResult.error.message,
        });
        return err(tokenContextResult.error);
      }

      const tokenContext = tokenContextResult.value;

      // Get shortContext from token table
      let shortContext: string = FALLBACK_SHORT_CONTEXT;
      if (tokensRepository && request.tokenMeta) {
        const tokenResult = await tokensRepository.findById(request.tokenMeta.id);
        if (tokenResult.isOk() && tokenResult.value?.shortContext) {
          shortContext = tokenResult.value.shortContext;
        }
      }

      const systemPrompt = buildTokenSystemPrompt();
      const userPrompt = buildTokenUserPrompt(paintingContext, tokenContext, vp, shortContext);

      const aiResult = await workersAiClient.generateText({
        systemPrompt,
        userPrompt,
      });

      if (aiResult.isErr()) {
        log.error("prompt.compose.token.ai.error", {
          tokenName: paintingContext.t.n,
          chain: paintingContext.t.c,
          errorType: aiResult.error.type,
          message: aiResult.error.message,
          ...(aiResult.error.type === "ExternalApiError" ? { provider: aiResult.error.provider } : {}),
        });
        return err(aiResult.error);
      }

      const generatedText = aiResult.value.text.trim();
      const promptText = `${generatedText}\n\ncontrols: paramsHash=${paramsHash}, seed=${seed}`;

      const composition: PromptComposition = {
        seed,
        minuteBucket,
        vp,
        prompt: {
          text: promptText,
          negative: WORLD_PAINTING_NEGATIVE_PROMPT,
          size: DEFAULT_IMAGE_SIZE,
          format: "webp",
          seed,
          filename,
        },
        paramsHash,
      };

      log.info("prompt.compose.token.success", {
        tokenName: paintingContext.t.n,
        chain: paintingContext.t.c,
        paramsHash,
        minuteBucket,
        modelId: aiResult.value.modelId,
        promptLength: generatedText.length,
      });

      return ok(composition);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown token prompt composition error";
      log.error("prompt.compose.token.unexpected", { message });
      return err({ type: "InternalError", message, cause: error });
    }
  }

  return { composeTokenPrompt };
}
