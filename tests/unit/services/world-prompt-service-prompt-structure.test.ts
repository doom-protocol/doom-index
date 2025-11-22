import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { ok } from "neverthrow";
import { createWorldPromptService } from "@/services/world-prompt-service";
import type { TokenAnalysisService } from "@/services/token-analysis-service";
import type { WorkersAiClient } from "@/lib/workers-ai-client";
import type { PaintingContext } from "@/types/painting-context";
import {
  MEDIEVAL_ALLEGORICAL_OPENING,
  MEDIEVAL_ALLEGORICAL_STYLE_DESCRIPTION,
} from "@/constants/prompts/world-painting";

describe("WorldPromptService - FLUX Prompt Structure", () => {
  let mockTokenAnalysisService: TokenAnalysisService;
  let mockWorkersAiClient: WorkersAiClient;

  const baseContext: PaintingContext = {
    t: { n: "Test Token", c: "ethereum" },
    m: { mc: 1_000_000, bd: 450_000, fg: 120_000 },
    s: { p: 1.0, p7: 25.0, v: 900_000, mc: 1_200_000, vol: 0.3 },
    c: "euphoria",
    a: "l1-sovereign",
    e: { k: "rally", i: 2 },
    o: "central-altar",
    p: "solar-gold",
    d: { dir: "up", vol: "medium" },
    f: [],
    h: [],
  };

  const mockShortContext = "A test token for validation.";

  beforeEach(() => {
    mockTokenAnalysisService = {
      generateAndSaveShortContext: mock(() =>
        Promise.resolve(ok(mockShortContext)),
      ) as unknown as TokenAnalysisService["generateAndSaveShortContext"],
    };

    mockWorkersAiClient = {
      generateText: mock(() =>
        Promise.resolve(
          ok({
            modelId: "@cf/ibm-granite/granite-4.0-h-micro",
            text: `${MEDIEVAL_ALLEGORICAL_OPENING}
a divine monarch ascending a thousand-step stairway to heaven, golden crown being placed by celestial hands,
(jubilant crowds throwing flowers and golden coins:1.20),
(priests blessing the ascent with sacred oils:1.10),
${MEDIEVAL_ALLEGORICAL_STYLE_DESCRIPTION}`,
          }),
        ),
      ) as unknown as WorkersAiClient["generateText"],
      generateJson: mock(() => Promise.resolve(ok({}))) as unknown as WorkersAiClient["generateJson"],
    };
  });

  afterEach(() => {
    mock.restore();
  });

  const createService = () =>
    createWorldPromptService({
      tokenAnalysisService: mockTokenAnalysisService,
      workersAiClient: mockWorkersAiClient,
      getMinuteBucket: () => "2025-11-21T10:00",
    });

  it("system prompt includes FLUX framework structure instructions", async () => {
    const service = createService();
    const result = await service.composeTokenPrompt({
      paintingContext: baseContext,
    });

    expect(result.isOk()).toBe(true);
    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const systemPrompt = generateTextCall[0].systemPrompt;

    // Check FLUX framework is mentioned
    expect(systemPrompt).toContain("FLUX Prompt Framework");
    expect(systemPrompt).toContain("Subject + Action + Style + Context");
    expect(systemPrompt).toContain("Context-Focused for Landscapes");
    expect(systemPrompt).toContain("SETTING");
    expect(systemPrompt).toContain("MAIN ACTION");
    expect(systemPrompt).toContain("SUPPORTING ELEMENTS");
    expect(systemPrompt).toContain("ATMOSPHERE");
    expect(systemPrompt).toContain("STYLE");
  });

  it("system prompt includes word order guidance", async () => {
    const service = createService();
    await service.composeTokenPrompt({
      paintingContext: baseContext,
    });

    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const systemPrompt = generateTextCall[0].systemPrompt;

    expect(systemPrompt).toContain("WORD ORDER MATTERS");
    expect(systemPrompt).toContain("Front-load");
  });

  it("system prompt includes positive framing guidance", async () => {
    const service = createService();
    await service.composeTokenPrompt({
      paintingContext: baseContext,
    });

    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const systemPrompt = generateTextCall[0].systemPrompt;

    expect(systemPrompt).toContain("POSITIVE FRAMING");
    expect(systemPrompt).toContain("positive descriptions instead of negative prompts");
  });

  it("system prompt includes narrative focus guidance", async () => {
    const service = createService();
    await service.composeTokenPrompt({
      paintingContext: baseContext,
    });

    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const systemPrompt = generateTextCall[0].systemPrompt;

    expect(systemPrompt).toContain("NARRATIVE FOCUS");
    expect(systemPrompt).toContain("decisive moment");
    expect(systemPrompt).toContain("actions happening");
  });

  it("user prompt includes narrative moment for rising-euphoria scenario", async () => {
    const context: PaintingContext = {
      ...baseContext,
      s: { ...baseContext.s, p7: 25.0 },
      c: "euphoria",
    };

    const service = createService();
    await service.composeTokenPrompt({
      paintingContext: context,
    });

    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const userPrompt = generateTextCall[0].userPrompt;

    expect(userPrompt).toContain("NARRATIVE MOMENT");
    expect(userPrompt).toContain("rising-euphoria");
    expect(userPrompt).toContain("coronation");
  });

  it("user prompt includes narrative moment for falling-panic scenario", async () => {
    const context: PaintingContext = {
      ...baseContext,
      s: { ...baseContext.s, p7: -30.0 },
      c: "panic",
    };

    const service = createService();
    await service.composeTokenPrompt({
      paintingContext: context,
    });

    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const userPrompt = generateTextCall[0].userPrompt;

    expect(userPrompt).toContain("falling-panic");
    expect(userPrompt).toContain("collapse");
  });

  it("user prompt includes action element for dramatic price changes", async () => {
    const context: PaintingContext = {
      ...baseContext,
      s: { ...baseContext.s, p7: 25.0 }, // > 20% change
    };

    const service = createService();
    await service.composeTokenPrompt({
      paintingContext: context,
    });

    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const userPrompt = generateTextCall[0].userPrompt;

    expect(userPrompt).toContain("golden seeds sprouting");
  });

  it("user prompt includes action element for dramatic price drops", async () => {
    const context: PaintingContext = {
      ...baseContext,
      s: { ...baseContext.s, p7: -25.0 }, // < -20% change
    };

    const service = createService();
    await service.composeTokenPrompt({
      paintingContext: context,
    });

    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const userPrompt = generateTextCall[0].userPrompt;

    expect(userPrompt).toContain("meteor striking");
  });

  it("user prompt includes FLUX structure instructions", async () => {
    const service = createService();
    await service.composeTokenPrompt({
      paintingContext: baseContext,
    });

    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const userPrompt = generateTextCall[0].userPrompt;

    expect(userPrompt).toContain("FLUX PROMPT STRUCTURE");
    expect(userPrompt).toContain("SETTING");
    expect(userPrompt).toContain("MAIN ACTION");
    expect(userPrompt).toContain("SUPPORTING ELEMENTS");
    expect(userPrompt).toContain("ATMOSPHERE");
    expect(userPrompt).toContain("STYLE");
  });

  it("user prompt includes character action based on context", async () => {
    const context: PaintingContext = {
      ...baseContext,
      c: "euphoria",
      s: { ...baseContext.s, p7: 10.0 },
    };

    const service = createService();
    await service.composeTokenPrompt({
      paintingContext: context,
    });

    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const userPrompt = generateTextCall[0].userPrompt;

    // Character action should be included in the user prompt instructions
    // Check for any of the character action patterns
    expect(userPrompt).toMatch(
      /wine-drunk crowd|lifting hero|shoulders|confetti|kneeling|prayers|fleeing|exodus|revolt|storming/,
    );
  });

  it("user prompt includes i2i instructions when reference image is provided", async () => {
    const service = createService();
    await service.composeTokenPrompt({
      paintingContext: baseContext,
      referenceImageUrl: "https://example.com/logo.png",
    });

    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const userPrompt = generateTextCall[0].userPrompt;

    expect(userPrompt).toContain("IMAGE-TO-IMAGE (i2i)");
    expect(userPrompt).toContain("maintaining classical oil painting technique");
    expect(userPrompt).toContain("preserving traditional renaissance master style");
  });

  it("user prompt includes narrative moment for extreme volatility", async () => {
    const context: PaintingContext = {
      ...baseContext,
      s: { ...baseContext.s, vol: 0.8 }, // > 0.7
    };

    const service = createService();
    await service.composeTokenPrompt({
      paintingContext: context,
    });

    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const userPrompt = generateTextCall[0].userPrompt;

    expect(userPrompt).toContain("extreme-volatility");
    expect(userPrompt).toContain("battle");
  });

  it("user prompt includes positive framing reminders", async () => {
    const service = createService();
    await service.composeTokenPrompt({
      paintingContext: baseContext,
    });

    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const userPrompt = generateTextCall[0].userPrompt;

    expect(userPrompt).toContain("positive framing");
    expect(userPrompt).toContain("describe what you want to see");
  });

  it("user prompt includes active verb guidance", async () => {
    const service = createService();
    await service.composeTokenPrompt({
      paintingContext: baseContext,
    });

    const generateTextCall = (mockWorkersAiClient.generateText as ReturnType<typeof mock>).mock.calls[0];
    const userPrompt = generateTextCall[0].userPrompt;

    expect(userPrompt).toContain("active verbs");
    expect(userPrompt).toContain("ascending");
    expect(userPrompt).toContain("collapsing");
    expect(userPrompt).toContain("emerging");
  });
});
