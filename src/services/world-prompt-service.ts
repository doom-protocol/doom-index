import { PROMPT_TUNING } from "@/constants/prompt-params";
import {
  CHARACTER_NARRATIVES,
  MEDIEVAL_ALLEGORICAL_OPENING,
  MEDIEVAL_ALLEGORICAL_STYLE_DESCRIPTION,
  MEDIEVAL_FIGURES_ELEMENT,
  NARRATIVE_MOMENTS,
  SYMBOLIC_ELEMENTS,
  WORLD_PAINTING_NEGATIVE_PROMPT,
  getActionElement,
  getNarrativeMomentKey,
  getSymbolicElementForArchetypeClimate,
} from "@/constants/prompts/world-painting";
import { buildGenerationFileName, hashVisualParams, seedForMinute } from "@/lib/pure/hash";
import { type VisualParams } from "@/lib/pure/mapping";
import type { WorkersAiClient } from "@/lib/workers-ai-client";
import type { TokensRepository } from "@/repositories/tokens-repository";
import type { TokenAnalysisService, TokenMetaInput, TokenOperationInput } from "@/services/token-analysis-service";
import { FALLBACK_SHORT_CONTEXT } from "@/services/token-analysis-service";
import type { AppError } from "@/types/app-error";
import type { PaintingContext } from "@/types/painting-context";
import { logger } from "@/utils/logger";
import { getMinuteBucket } from "@/utils/time";
import { err, ok, type Result } from "neverthrow";

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

/**
 * Input for token prompt composition - allows optional tokenMeta for fallback handling
 */
type TokenPromptRequest = Omit<TokenOperationInput, "tokenMeta"> & {
  tokenMeta?: TokenMetaInput;
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
 * - World painting prompt composition using FLUX framework
 *
 * FLUX Prompt Framework (Subject + Action + Style + Context):
 * - Context-focused prompts for landscapes: Setting → Atmosphere → Style → Technical
 * - Word order matters: Front-load important elements
 * - Positive framing: Avoid negative prompts, use positive alternatives
 * - Enhancement layers: Foundation + Visual + Technical + Atmospheric
 *
 * @see https://docs.bfl.ai/guides/prompting_summary
 * @see docs/flux-prompting-guide.md
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

    // Determine placement based on composition - vary positions to avoid repetitive sky placements
    let placement = "carved into an ancient stone monument at the scene's center";
    switch (ctx.o) {
      case "central-altar":
        placement = "prominently displayed on the sacred altar stone";
        break;
      case "procession":
        placement = "emblazoned on the lead figure's shield and armor";
        break;
      case "citadel-panorama":
        placement = "carved into the foundation stones of the main gate";
        break;
      case "storm-battlefield":
        placement = "etched into the commander's banner pole";
        break;
      case "cosmic-horizon":
        placement = "reflected in the surface of a mystical pool at the foreground";
        break;
    }

    return `Use the reference image as a ${role} ${placement}. Ensure the token logo is subtly integrated into the classical oil painting composition without dominating the overall renaissance master style.`;
  };

  const buildTokenSystemPrompt = (hasReferenceImage: boolean): string => {
    const referenceImageInstruction = hasReferenceImage
      ? `\n\n5. IMAGE-TO-IMAGE (i2i) REQUIREMENTS:
   - A reference image (token logo) is provided. You MUST incorporate this image into the painting.
   - CRITICAL: Explicitly state style preservation: "maintaining classical oil painting technique with visible brushwork and impasto texture"
   - Include explicit integration instructions like: "(token logo integrated into the scene as divine royal seal:1.20)"
   - The reference image must be rendered in the same classical oil painting style as the rest of the composition.
   - Be comprehensive: Specify what to change (logo integration) and what to maintain (oil painting style, composition, atmosphere).`
      : "";

    return `You are an AI art director specializing in FLUX-optimized medieval allegorical oil painting prompts for DOOM INDEX, a generative art project that visualizes cryptocurrency market dynamics as allegorical paintings.

CRITICAL: Follow FLUX Prompt Framework (Subject + Action + Style + Context) with context-focused structure for landscapes.

FLUX PROMPT STRUCTURE (Context-Focused for Landscapes):
1. SETTING (Scene/Context) - Lead with the scene/setting
2. MAIN ACTION - The decisive moment being captured
3. SUPPORTING ELEMENTS - Figures, objects, symbols with actions
4. ATMOSPHERE - Lighting, weather, mood
5. STYLE - Artistic technique and medium

WORD ORDER MATTERS: Front-load the most important elements. FLUX pays more attention to what comes first.

PROMPT COMPOSITION RULES:

1. Start with the scene/setting (context-focused approach):
   "${MEDIEVAL_ALLEGORICAL_OPENING}"

2. Then describe the MAIN ACTION (the decisive moment):
   - Use active verbs: "ascending", "collapsing", "emerging", "clashing"
   - Capture a specific moment in time, not a static state
   - Example: "a divine monarch ascending a thousand-step stairway to heaven, golden crown being placed"

3. Add SUPPORTING ELEMENTS with weighted format: (element description:weight_value)
   - Each element should describe an action or transformation, not just a static object
   - Use weight values between 0.50 and 1.50 (format as 2 decimal places)
   - Include figures with specific actions: "jubilant crowds throwing flowers" not just "crowds"
   - Always include: ${MEDIEVAL_FIGURES_ELEMENT}
   ${referenceImageInstruction}

4. Add ATMOSPHERIC LAYER:
   - Lighting conditions, weather, time of day
   - Mood and emotional tone
   - Color palette hints

5. End with STYLE DESCRIPTION:
   "${MEDIEVAL_ALLEGORICAL_STYLE_DESCRIPTION}"

POSITIVE FRAMING:
- Use positive descriptions instead of negative prompts
- Instead of "no chaos" → "peaceful order"
- Instead of "without modern elements" → "classical medieval elements"

NARRATIVE FOCUS:
- Tell a story with a decisive moment
- Show actions happening, not just static scenes
- Use temporal elements: "transforming", "emerging", "collapsing"
- Create visual causality: show what causes what

Example structure:
"${MEDIEVAL_ALLEGORICAL_OPENING}
a divine monarch ascending a thousand-step stairway to heaven, golden crown being placed by celestial hands,
(jubilant crowds throwing flowers and golden coins:1.20),
(priests blessing the ascent with sacred oils:1.10),
(angels descending with crowns and banners:1.15),
${MEDIEVAL_FIGURES_ELEMENT}${hasReferenceImage ? ",\n(token logo integrated into the scene as divine royal seal, maintaining classical oil painting technique:1.25)," : ""}
radiant golden light breaking through clouds, rainbow halos surrounding the monarch, warm sunrise colors,
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

    // Get narrative moment based on market dynamics
    const isTokenPositive = ctx.s.p7 >= 0;
    const narrativeMomentKey = getNarrativeMomentKey(isTokenPositive, ctx.c, ctx.s.vol);
    const narrativeMoment = NARRATIVE_MOMENTS[narrativeMomentKey];

    // Get action element based on price change
    const priceAction = getActionElement(ctx.s.p7);

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
        weight: Math.min(
          PROMPT_TUNING.secondaryElement.weightMax,
          vp.fogDensity * PROMPT_TUNING.secondaryElement.weightScale,
        ),
      });
    }
    if (vp.blueBalance > PROMPT_TUNING.secondaryElement.threshold) {
      secondaryElements.push({
        text: SYMBOLIC_ELEMENTS["glittering blue glaciers and cold reflections"],
        weight: Math.min(
          PROMPT_TUNING.secondaryElement.weightMax,
          vp.blueBalance * PROMPT_TUNING.secondaryElement.weightScale,
        ),
      });
    }
    if (vp.vegetationDensity > PROMPT_TUNING.secondaryElement.threshold) {
      secondaryElements.push({
        text: SYMBOLIC_ELEMENTS["lush emerald forests and living roots"],
        weight: Math.min(
          PROMPT_TUNING.secondaryElement.weightMax,
          vp.vegetationDensity * PROMPT_TUNING.secondaryElement.weightScale,
        ),
      });
    }
    if (vp.radiationGlow > PROMPT_TUNING.secondaryElement.threshold) {
      secondaryElements.push({
        text: SYMBOLIC_ELEMENTS["blinding nuclear flash on the horizon"],
        weight: Math.min(
          PROMPT_TUNING.secondaryElement.weightMax,
          vp.radiationGlow * PROMPT_TUNING.secondaryElement.weightScale,
        ),
      });
    }
    if (vp.mechanicalPattern > PROMPT_TUNING.secondaryElement.threshold) {
      secondaryElements.push({
        text: SYMBOLIC_ELEMENTS["colossal dystopian machine towers and metal grids"],
        weight: Math.min(
          PROMPT_TUNING.secondaryElement.weightMax,
          vp.mechanicalPattern * PROMPT_TUNING.secondaryElement.weightScale,
        ),
      });
    }
    if (vp.bioluminescence > PROMPT_TUNING.secondaryElement.threshold) {
      secondaryElements.push({
        text: SYMBOLIC_ELEMENTS["bioluminescent spores and organic clusters"],
        weight: Math.min(
          PROMPT_TUNING.secondaryElement.weightMax,
          vp.bioluminescence * PROMPT_TUNING.secondaryElement.weightScale,
        ),
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

    // Determine character action based on context
    let characterAction = "";
    if (ctx.c === "euphoria" && isTokenPositive) {
      characterAction = CHARACTER_NARRATIVES.crowd_action.celebrate;
    } else if (ctx.c === "panic" || ctx.c === "despair") {
      characterAction = CHARACTER_NARRATIVES.crowd_action.flee;
    } else if (ctx.s.vol > 0.5) {
      characterAction = CHARACTER_NARRATIVES.crowd_action.revolt;
    } else {
      characterAction = CHARACTER_NARRATIVES.crowd_action.worship;
    }

    return [
      `Generate a FLUX-optimized medieval allegorical oil painting prompt following the exact structure specified.`,
      ``,
      `FLUX PROMPT STRUCTURE (Context-Focused for Landscapes):`,
      `1. SETTING (Scene/Context) - Lead with the scene`,
      `2. MAIN ACTION - The decisive moment being captured`,
      `3. SUPPORTING ELEMENTS - Figures, objects, symbols with actions (use weighted format)`,
      `4. ATMOSPHERE - Lighting, weather, mood`,
      `5. STYLE - Artistic technique and medium`,
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
      `- Price Change (7d): ${ctx.s.p7.toFixed(2)}%`,
      `- Volatility Index: ${numberFormatter.format(ctx.s.vol)}`,
      ``,
      `NARRATIVE MOMENT (${narrativeMomentKey}):`,
      `- Scene: ${narrativeMoment.scene}`,
      `- Main Action: ${narrativeMoment.mainAction}${priceAction ? `, ${priceAction}` : ""}`,
      `- Figures: ${narrativeMoment.figures}, ${characterAction}`,
      `- Atmosphere: ${narrativeMoment.atmosphere}`,
      `- Symbols: ${narrativeMoment.symbols}`,
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
      `PROMPT COMPOSITION INSTRUCTIONS:`,
      `1. Start with: "${MEDIEVAL_ALLEGORICAL_OPENING}"`,
      `2. Then describe the MAIN ACTION: "${narrativeMoment.mainAction}"${priceAction ? `, "${priceAction}"` : ""}`,
      `3. Add SUPPORTING ELEMENTS in weighted format: (element description:weight_value)`,
      `   - Include: "${narrativeMoment.figures}" (weight: 1.15)`,
      `   - Include: "${characterAction}" (weight: 1.10)`,
      `   - Include primary element: "${primaryElement}" (weight: ${primaryWeight})`,
      `   - Include relevant secondary elements from the list above`,
      `   - Always include: ${MEDIEVAL_FIGURES_ELEMENT}`,
      `4. Add ATMOSPHERIC LAYER: "${narrativeMoment.atmosphere}"`,
      `5. Add SYMBOLIC ELEMENTS: "${narrativeMoment.symbols}" (weight: 1.05)`,
      ...(referenceImageUrl
        ? [
            ``,
            `6. IMAGE-TO-IMAGE (i2i) REQUIREMENTS:`,
            `   - A reference image (token logo) is provided and MUST be integrated.`,
            `   - Include: "(token logo integrated into the scene as ${ctx.a === "l1-sovereign" ? "divine royal seal" : ctx.a === "meme-ascendant" ? "worshipped idol symbol" : "divine sacred logo"}, maintaining classical oil painting technique:1.10)"`,
            `   - ALWAYS include style preservation: "(maintaining classical oil painting technique with visible brushwork and impasto texture:1.5)" and "(preserving traditional renaissance master style throughout entire composition:1.4)"`,
            `   - Be comprehensive: Specify what to change (logo integration) and what to maintain (oil painting style, composition, atmosphere).`,
          ]
        : []),
      `7. End with: "${MEDIEVAL_ALLEGORICAL_STYLE_DESCRIPTION}"`,
      ``,
      `CRITICAL REMINDERS:`,
      `- Use active verbs: "ascending", "collapsing", "emerging", "clashing"`,
      `- Capture a specific moment in time, not a static state`,
      `- Use positive framing: describe what you want to see, not what to avoid`,
      `- Front-load the most important elements (word order matters in FLUX)`,
      `- Tell a story with a decisive moment`,
      `- Show actions happening, not just static scenes`,
      ``,
      `Respond with ONLY the prompt text in the exact format specified. Do not include markdown, bullet points, headings, commentary, or negative prompts.`,
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
