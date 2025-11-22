import { err, ok, Result } from "neverthrow";
import { type VisualParams } from "@/lib/pure/mapping";
import { hashVisualParams, seedForMinute, buildGenerationFileName } from "@/lib/pure/hash";
import {
  WORLD_PAINTING_NEGATIVE_PROMPT,
  MEDIEVAL_ALLEGORICAL_OPENING,
  MEDIEVAL_ALLEGORICAL_STYLE_DESCRIPTION,
  MEDIEVAL_FIGURES_ELEMENT,
  SYMBOLIC_ELEMENTS,
  getSymbolicElementForArchetypeClimate,
} from "@/constants/prompts/world-painting";
import { getMinuteBucket } from "@/utils/time";
import { logger } from "@/utils/logger";
import type { AppError } from "@/types/app-error";
import type { PaintingContext } from "@/types/painting-context";
import type { TokenAnalysisService, TokenMetaInput } from "@/services/token-analysis-service";
import { FALLBACK_SHORT_CONTEXT } from "@/services/token-analysis-service";
import type { WorkersAiClient } from "@/lib/workers-ai-client";
import type { TokensRepository } from "@/repositories/tokens-repository";
import { PROMPT_TUNING } from "@/constants/prompt-params";

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

type TokenPromptRequest = {
  paintingContext: PaintingContext;
  tokenMeta?: TokenMetaInput;
  referenceImageUrl?: string | null;
};

type WorldPromptServiceDeps = {
  tokenAnalysisService?: TokenAnalysisService;
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
const DEFAULT_IMAGE_SIZE = PROMPT_TUNING.imageSize;

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function createWorldPromptService({
  tokenAnalysisService,
  tokensRepository,
  workersAiClient,
  getMinuteBucket: minuteBucketFn = () => getMinuteBucket(),
  log = logger,
}: WorldPromptServiceDeps = {}): WorldPromptService {
  /**
   * Generate VisualParams deterministically based on context
   *
   * Inputs:
   * - minuteBucket: string minute ISO (e.g. "2025-11-21T10:00")
   * - ctx.t.c (chain), ctx.a (archetype), ctx.o (composition)
   *
   * Method:
   * - Build a seed string: `${minute}:${chain}:${archetype}:${composition}`
   * - Compute SHA-256 and normalize bytes to [0, 1] by dividing each byte by 255
   * - Map the first 16 normalized values to the 16 VisualParams fields
   *
   * Ranges:
   * - All VisualParams fields are floats in [0.0, 1.0]
   * - Downstream, these values are used with simple thresholds (e.g. > 0.3)
   *   and weight scaling up to 1.5 (see buildTokenUserPrompt)
   *
   * Determinism and reproducibility:
   * - For a given (minuteBucket, chain, archetype, composition), the same
   *   VisualParams are produced. Any change to those inputs will change the
   *   params, hash, and seed.
   *
   * Note on distribution:
   * - Using single bytes (0-255)/255 yields [0, 1] values. If a broader spread
   *   is desired across parameters, consider combining two bytes per field and
   *   normalizing a 16-bit integer by 65535 for each param. That keeps
   *   determinism while improving granularity.
   */
  const generateVisualParams = async (ctx: PaintingContext, minuteBucket: string): Promise<VisualParams> => {
    // Create a deterministic seed string from context
    // Use token symbol, archetype, composition, and minute bucket
    const seedInput = `${minuteBucket}:${ctx.t.c}:${ctx.a}:${ctx.o}`;

    // Use simple hash function to generate values
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seedInput));
    const bytes = new Uint8Array(hashBuffer);

    // Helper to get float 0-1 from byte index
    const getVal = (idx: number) => bytes[idx % bytes.length] / 255;

    return {
      fogDensity: getVal(0),
      skyTint: getVal(1),
      reflectivity: getVal(2),
      blueBalance: getVal(3),
      vegetationDensity: getVal(4),
      organicPattern: getVal(5),
      radiationGlow: getVal(6),
      debrisIntensity: getVal(7),
      mechanicalPattern: getVal(8),
      metallicRatio: getVal(9),
      fractalDensity: getVal(10),
      bioluminescence: getVal(11),
      shadowDepth: getVal(12),
      redHighlight: getVal(13),
      lightIntensity: getVal(14),
      warmHue: getVal(15),
    };
  };

  const buildPromptMetadata = async (ctx: PaintingContext) => {
    const minuteBucket = minuteBucketFn();
    // Generate visual params based on context instead of legacy map
    const vp = await generateVisualParams(ctx, minuteBucket);
    const paramsHash = await hashVisualParams(vp);
    const seed = await seedForMinute(minuteBucket, paramsHash);
    const filename = buildGenerationFileName(minuteBucket, paramsHash, seed);

    return { vp, paramsHash, minuteBucket, seed, filename };
  };

  const getReferenceIntegrationInstruction = (ctx: PaintingContext): string => {
    // Determine role based on archetype
    let role = "divine sacred logo";
    switch (ctx.a) {
      case "l1-sovereign":
        role = "divine royal seal";
        break;
      case "meme-ascendant":
        role = "worshipped idol symbol";
        break;
      case "ai-oracle":
        role = "glowing holographic glyph";
        break;
      case "perp-liquidity":
        role = "golden financial emblem";
        break;
      case "privacy":
        role = "shadowy encrypted sigil";
        break;
      case "political":
        role = "grand political crest";
        break;
      default:
        role = "mysterious ancient symbol";
    }

    // Determine placement based on composition
    let placement = "floating high in the sky";
    switch (ctx.o) {
      case "central-altar":
        placement = "hovering above the central altar";
        break;
      case "procession":
        placement = "emblazoned on banners carried by the crowd";
        break;
      case "citadel-panorama":
        placement = "etched into the highest tower of the citadel";
        break;
      case "storm-battlefield":
        placement = "shining through the storm clouds above the battlefield";
        break;
      case "cosmic-horizon":
        placement = "hanging in the sky like a celestial body";
        break;
    }

    return `Use the reference image as a ${role} ${placement}.`;
  };

  const buildTokenSystemPrompt = (hasReferenceImage: boolean): string => {
    const referenceImageInstruction = hasReferenceImage
      ? `\n5. IMPORTANT: A reference image (token logo) is provided. You MUST incorporate this image into the painting. Include explicit instructions like: "(token logo integrated into the scene:1.20)" or "(token symbol visible in the composition:1.15)" or similar phrasing that ensures the reference image is prominently featured and seamlessly blended into the allegorical scene.`
      : "";

    return `You are an AI art director specializing in medieval allegorical oil painting prompts for DOOM INDEX, a generative art project that visualizes cryptocurrency market dynamics as allegorical paintings.

CRITICAL: You must follow this exact prompt structure and tone:

1. Start with: "${MEDIEVAL_ALLEGORICAL_OPENING}"

2. Then list weighted elements in parentheses format: (element description:weight_value)
   - Each element should be a symbolic visual element related to the token's narrative
   - Use weight values between 0.50 and 1.50 (format as 2 decimal places like 1.00, 0.75, etc.)
   - Include elements that reflect the token's archetype, market climate, and visual directives
   - Always include: ${MEDIEVAL_FIGURES_ELEMENT}${referenceImageInstruction}

3. End with the fixed style description: "${MEDIEVAL_ALLEGORICAL_STYLE_DESCRIPTION}"

4. The tone must be:
   - Medieval/Renaissance allegorical painting style
   - Symbolic and metaphorical (not literal)
   - Cohesive single landscape with multiple forces visible
   - Weighted by real-time market power

Example structure:
"${MEDIEVAL_ALLEGORICAL_OPENING}
(token-specific symbolic element:1.00),
(another symbolic element:0.75),
${MEDIEVAL_FIGURES_ELEMENT}${hasReferenceImage ? ",\n(token logo integrated into the scene:1.20)," : ""}
${MEDIEVAL_ALLEGORICAL_STYLE_DESCRIPTION}"

Respond with ONLY the prompt text in this exact format. Do not include markdown, bullet points, headings, commentary, or negative prompts.`;
  };

  const buildTokenUserPrompt = (
    ctx: PaintingContext,
    vp: VisualParams,
    shortContext: string,
    referenceImageUrl?: string | null,
  ): string => {
    const motifLine = ctx.f.length ? ctx.f.join(", ") : "none";
    const hintsLine = ctx.h.length ? ctx.h.join(", ") : "none";

    // Get primary element from archetype/climate mapping
    const primaryElementKey = getSymbolicElementForArchetypeClimate(ctx.a, ctx.c);
    const primaryElement = SYMBOLIC_ELEMENTS[primaryElementKey];
    const primaryWeight = Math.max(
      PROMPT_TUNING.primaryElement.minWeight,
      Math.min(
        PROMPT_TUNING.primaryElement.maxWeight,
        ctx.s.vol * PROMPT_TUNING.primaryElement.volatilityScale + PROMPT_TUNING.primaryElement.offset,
      ),
    ).toFixed(2);

    // Calculate secondary elements based on visual params and context
    const secondaryElements: Array<{ text: string; weight: number }> = [];

    // Selection rule:
    // - Include an element when its associated vp value exceeds ~0.3
    // Weight rule:
    // - weight = min(1.5, vpValue * 1.5)  → yields weights in (0.0, 1.5]
    // Some elements also depend on market climate (e.g. despair/panic/euphoria)
    if (vp.fogDensity > PROMPT_TUNING.secondaryElement.threshold) {
      secondaryElements.push({
        text: SYMBOLIC_ELEMENTS["dense toxic smog in the sky"],
        weight: Math.min(PROMPT_TUNING.secondaryElement.weightMax, vp.fogDensity * PROMPT_TUNING.secondaryElement.weightScale),
      });
    }
    if (vp.blueBalance > PROMPT_TUNING.secondaryElement.threshold) {
      secondaryElements.push({
        text: SYMBOLIC_ELEMENTS["glittering blue glaciers and cold reflections"],
        weight: Math.min(PROMPT_TUNING.secondaryElement.weightMax, vp.blueBalance * PROMPT_TUNING.secondaryElement.weightScale),
      });
    }
    if (vp.vegetationDensity > PROMPT_TUNING.secondaryElement.threshold) {
      secondaryElements.push({
        text: SYMBOLIC_ELEMENTS["lush emerald forests and living roots"],
        weight: Math.min(PROMPT_TUNING.secondaryElement.weightMax, vp.vegetationDensity * PROMPT_TUNING.secondaryElement.weightScale),
      });
    }
    if (vp.radiationGlow > PROMPT_TUNING.secondaryElement.threshold) {
      secondaryElements.push({
        text: SYMBOLIC_ELEMENTS["blinding nuclear flash on the horizon"],
        weight: Math.min(PROMPT_TUNING.secondaryElement.weightMax, vp.radiationGlow * PROMPT_TUNING.secondaryElement.weightScale),
      });
    }
    if (vp.mechanicalPattern > PROMPT_TUNING.secondaryElement.threshold) {
      secondaryElements.push({
        text: SYMBOLIC_ELEMENTS["colossal dystopian machine towers and metal grids"],
        weight: Math.min(PROMPT_TUNING.secondaryElement.weightMax, vp.mechanicalPattern * PROMPT_TUNING.secondaryElement.weightScale),
      });
    }
    if (vp.bioluminescence > PROMPT_TUNING.secondaryElement.threshold) {
      secondaryElements.push({
        text: SYMBOLIC_ELEMENTS["bioluminescent spores and organic clusters"],
        weight: Math.min(PROMPT_TUNING.secondaryElement.weightMax, vp.bioluminescence * PROMPT_TUNING.secondaryElement.weightScale),
      });
    }
    if (vp.shadowDepth > PROMPT_TUNING.secondaryElement.threshold || ctx.c === "despair" || ctx.c === "panic") {
      secondaryElements.push({
        text: SYMBOLIC_ELEMENTS["oppressive darkness with many red eyes"],
        weight: Math.min(
          PROMPT_TUNING.secondaryElement.weightMax,
          (vp.shadowDepth || PROMPT_TUNING.secondaryElement.climateShadowFallback) *
            PROMPT_TUNING.secondaryElement.weightScale,
        ),
      });
    }
    if (vp.lightIntensity > PROMPT_TUNING.secondaryElement.threshold || ctx.c === "euphoria") {
      secondaryElements.push({
        text: SYMBOLIC_ELEMENTS["radiant golden divine light breaking the clouds"],
        weight: Math.min(
          PROMPT_TUNING.secondaryElement.weightMax,
          (vp.lightIntensity || PROMPT_TUNING.secondaryElement.climateLightFallback) *
            PROMPT_TUNING.secondaryElement.weightScale,
        ),
      });
    }

    // Sort by weight descending and limit to top 5-7 elements
    secondaryElements.sort((a, b) => b.weight - a.weight);
    const selectedElements = secondaryElements.slice(0, PROMPT_TUNING.secondaryElement.maxElements);

    return [
      `Generate a medieval allegorical oil painting prompt following the exact structure specified.`,
      ``,
      `Token Context:`,
      `- Name: ${ctx.t.n} (${ctx.t.c})`,
      `- Short Narrative: ${shortContext}`,
      ``,
      `Market Dynamics:`,
      `- Market Climate: ${ctx.c}`,
      `- Token Archetype: ${ctx.a}`,
      `- Event: ${ctx.e.k} (intensity ${ctx.e.i})`,
      `- Trend Direction: ${ctx.d.dir} (${ctx.d.vol} volatility)`,
      `- Volatility Index: ${numberFormatter.format(ctx.s.vol)}`,
      ``,
      `Visual Directives:`,
      `- Composition: ${ctx.o}`,
      `- Palette: ${ctx.p}`,
      `- Motifs: ${motifLine}`,
      `- Narrative Hints: ${hintsLine}`,
      ``,
      `Primary Symbolic Element (based on archetype and climate):`,
      `- "${primaryElement}" (weight: ${primaryWeight})`,
      ``,
      `Secondary Symbolic Elements (based on visual params):`,
      ...selectedElements.map(el => `- "${el.text}" (weight: ${el.weight.toFixed(2)})`),
      ``,
      `Instructions:`,
      `Create a prompt that starts with "${MEDIEVAL_ALLEGORICAL_OPENING}"`,
      `Then list 4-8 weighted elements in parentheses format: (element:weight),`,
      `Include the primary element with weight ${primaryWeight},`,
      `Include relevant secondary elements from the list above,`,
      `Always include: ${MEDIEVAL_FIGURES_ELEMENT},`,
      ...(referenceImageUrl
        ? [
            ``,
            `CRITICAL: A reference image (token logo) is provided and MUST be integrated into the painting.`,
            `Include an explicit element like: "(token logo integrated into the scene:1.20)" or "(token symbol visible in the composition:1.15)" or "(token emblem seamlessly blended into the allegorical landscape:1.25)".`,
            `The reference image should be prominently featured and naturally incorporated into the medieval allegorical scene.`,
          ]
        : []),
      `End with: "${MEDIEVAL_ALLEGORICAL_STYLE_DESCRIPTION}"`,
      `Use symbolic, metaphorical language. Elements should reflect the token's narrative, market state, and visual directives.`,
      `Respond with ONLY the prompt text, no additional commentary.`,
    ].join("\n");
  };

  const resolveShortContext = async (request: TokenPromptRequest): Promise<Result<string, AppError>> => {
    if (!request.tokenMeta) {
      return ok(FALLBACK_SHORT_CONTEXT);
    }

    // 1. Try to get from repository
    if (tokensRepository) {
      const tokenResult = await tokensRepository.findById(request.tokenMeta.id);
      if (tokenResult.isOk() && tokenResult.value?.shortContext) {
        return ok(tokenResult.value.shortContext);
      }
    }

    // 2. Generate if not found
    if (!tokenAnalysisService) {
      log.warn("prompt.compose.token.context.missing-service", {
        tokenId: request.tokenMeta.id,
        message: "tokenAnalysisService not available, using fallback",
      });
      return ok(FALLBACK_SHORT_CONTEXT);
    }

    return tokenAnalysisService.generateAndSaveShortContext(request.tokenMeta);
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
      const { vp, paramsHash, minuteBucket, seed, filename } = await buildPromptMetadata(paintingContext);

      log.debug("prompt.compose.token.start", {
        tokenName: paintingContext.t.n,
        chain: paintingContext.t.c,
        hasTokenMeta: Boolean(request.tokenMeta),
      });

      const shortContextResult = await resolveShortContext(request);
      if (shortContextResult.isErr()) {
        log.error("prompt.compose.token.context.error", {
          tokenName: paintingContext.t.n,
          chain: paintingContext.t.c,
          errorType: shortContextResult.error.type,
          message: shortContextResult.error.message,
        });
        return err(shortContextResult.error);
      }

      const shortContext = shortContextResult.value;
      const hasReferenceImage = Boolean(request.referenceImageUrl);

      const systemPrompt = buildTokenSystemPrompt(hasReferenceImage);
      const userPrompt = buildTokenUserPrompt(paintingContext, vp, shortContext, request.referenceImageUrl);

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

      // For image-to-image with reference image, prepend dynamic instruction
      // to integrate the token logo into the scene based on context
      const promptPrefix = hasReferenceImage ? `${getReferenceIntegrationInstruction(paintingContext)} ` : "";

      const promptText = `${promptPrefix}${generatedText}\n\ncontrols: paramsHash=${paramsHash}, seed=${seed}`;

      // For image-to-image with reference image, remove "logo" from negative prompt
      // to allow the token logo to be integrated into the scene
      const negativePrompt = hasReferenceImage
        ? WORLD_PAINTING_NEGATIVE_PROMPT.replace(/\s*,\s*\blogo\b\s*,?/gi, ",")
            .replace(/\s*,\s*,\s*/g, ",")
            .replace(/^,\s*|\s*,$/g, "")
            .replace(/\s+/g, " ")
            .trim()
        : WORLD_PAINTING_NEGATIVE_PROMPT;

      const composition: PromptComposition = {
        seed,
        minuteBucket,
        vp,
        prompt: {
          text: promptText,
          negative: negativePrompt,
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
