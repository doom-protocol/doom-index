import { describe, it, expect } from "bun:test";
import { createPromptService } from "@/services/prompt";
import { TOKEN_CONFIG_MAP, TOKEN_TICKERS, type McMap } from "@/constants/token";

const createRoundedMap = (multiplier: number): McMap =>
  TOKEN_TICKERS.reduce((acc, ticker, idx) => {
    const supply = TOKEN_CONFIG_MAP[ticker].supply;
    const value = supply * (multiplier + idx * 0.01);
    acc[ticker] = Math.round(value * 10_000) / 10_000;
    return acc;
  }, {} as McMap);

const createService = (minute = "2025-11-09T12:34") =>
  createPromptService({
    getMinuteBucket: () => minute,
  });

describe("PromptService.composePrompt (3.x)", () => {
  it("returns deterministic prompt composition including params hash and seed", async () => {
    const mcRounded = createRoundedMap(1.05);
    const service = createService();

    const result = await service.composePrompt(mcRounded);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const value = result.value;
      expect(value.paramsHash).toMatch(/^[a-f0-9]{8}$/);
      expect(value.seed).toMatch(/^[a-f0-9]{12}$/);
      expect(value.prompt.size).toEqual({ w: 1280, h: 720 });
      expect(value.prompt.format).toBe("webp");
      expect(value.prompt.text).toContain("medieval");
      expect(value.prompt.text).toContain("allegorical");
      expect(value.prompt.negative).toContain("watermark");
    }

    const repeated = await service.composePrompt(mcRounded);
    if (result.isOk() && repeated.isOk()) {
      expect(repeated.value.paramsHash).toBe(result.value.paramsHash);
      expect(repeated.value.seed).toBe(result.value.seed);
      expect(repeated.value.prompt.text).toBe(result.value.prompt.text);
    }
  });

  it("reacts to meaningful changes in rounded map with new hashes but keeps structure", async () => {
    const service = createService();
    const baseMap = createRoundedMap(0.0001); // Use smaller multiplier to avoid hitting max weight
    const changedMap = { ...baseMap, CO2: baseMap.CO2 * 2.0 }; // Significant change

    const base = await service.composePrompt(baseMap);
    const changed = await service.composePrompt(changedMap);
    if (base.isErr() || changed.isErr()) {
      throw new Error("Prompt composition should succeed");
    }
    expect(changed.value.paramsHash).not.toBe(base.value.paramsHash);
    expect(changed.value.seed).not.toBe(base.value.seed);
    // Prompt should be different due to different weights
    expect(changed.value.prompt.text).not.toBe(base.value.prompt.text);
  });

  it("keeps hashes stable for sub-quantization differences", async () => {
    const service = createService();
    const baseMap = createRoundedMap(1.2);
    const noisyMap = { ...baseMap, CO2: baseMap.CO2 * 1.0000001 };

    const base = await service.composePrompt(baseMap);
    const noisy = await service.composePrompt(noisyMap);
    if (base.isErr() || noisy.isErr()) {
      throw new Error("Prompt composition should succeed");
    }
    expect(noisy.value.paramsHash).toBe(base.value.paramsHash);
    expect(noisy.value.seed).toBe(base.value.seed);
  });
});
