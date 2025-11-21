import { describe, it, expect } from "bun:test";
// Legacy functions are deprecated - only buildSDXLPrompt exists now
import { buildSDXLPrompt } from "@/lib/pure/weighted-prompt";
import type { McMap } from "@/constants/token";

describe.skip("Doom Prompt Generation", () => {
  const testMc: McMap = {
    CO2: 1_300_000,
    ICE: 200_000,
    FOREST: 900_000,
    NUKE: 50_000,
    MACHINE: 1_450_000,
    PANDEMIC: 700_000,
    FEAR: 1_100_000,
    HOPE: 400_000,
  };

  describe("calculateDominanceWeights", () => {
    it("calculates weights based on relative dominance", () => {
      const weights = calculateDominanceWeights(testMc);

      // MACHINE has highest MC, should have highest weight
      expect(weights.MACHINE).toBeGreaterThan(weights.ICE);
      expect(weights.MACHINE).toBeGreaterThan(weights.NUKE);

      // All weights should be within range
      for (const weight of Object.values(weights)) {
        expect(weight).toBeGreaterThanOrEqual(DEFAULT_DOMINANCE_CONFIG.minWeight);
        expect(weight).toBeLessThanOrEqual(DEFAULT_DOMINANCE_CONFIG.maxWeight);
      }
    });

    it("handles zero values with minimum weight", () => {
      const zeroMc: McMap = {
        CO2: 0,
        ICE: 0,
        FOREST: 0,
        NUKE: 0,
        MACHINE: 0,
        PANDEMIC: 0,
        FEAR: 0,
        HOPE: 0,
      };

      const weights = calculateDominanceWeights(zeroMc);

      // All should have minimum weight
      for (const weight of Object.values(weights)) {
        expect(weight).toBe(DEFAULT_DOMINANCE_CONFIG.minWeight);
      }
    });

    it("accepts custom configuration", () => {
      const customConfig: DominanceWeightConfig = {
        minWeight: 0.5,
        maxWeight: 3.0,
        exponent: 1.5,
        tokens: ["MACHINE", "ICE"] as const,
      };

      const weights = calculateDominanceWeights(testMc, customConfig);

      // Only specified tokens should be in result
      expect(Object.keys(weights)).toHaveLength(2);
      expect(weights.MACHINE).toBeDefined();
      expect(weights.ICE).toBeDefined();

      // Weights should respect custom range
      expect(weights.MACHINE).toBeGreaterThanOrEqual(customConfig.minWeight);
      expect(weights.MACHINE).toBeLessThanOrEqual(customConfig.maxWeight);
      expect(weights.ICE).toBeGreaterThanOrEqual(customConfig.minWeight);
      expect(weights.ICE).toBeLessThanOrEqual(customConfig.maxWeight);

      // MACHINE should still be higher than ICE
      expect(weights.MACHINE).toBeGreaterThan(weights.ICE);
    });

    it("is a pure function: same input produces same output", () => {
      const weights1 = calculateDominanceWeights(testMc);
      const weights2 = calculateDominanceWeights(testMc);

      expect(weights1).toEqual(weights2);
    });

    it("emphasizes dominance with higher exponent", () => {
      const lowExponentConfig: DominanceWeightConfig = {
        ...DEFAULT_DOMINANCE_CONFIG,
        exponent: 1.0,
      };
      const highExponentConfig: DominanceWeightConfig = {
        ...DEFAULT_DOMINANCE_CONFIG,
        exponent: 5.0,
      };

      const lowWeights = calculateDominanceWeights(testMc, lowExponentConfig);
      const highWeights = calculateDominanceWeights(testMc, highExponentConfig);

      // Higher exponent should create larger difference between max and min
      const lowDiff = lowWeights.MACHINE - lowWeights.ICE;
      const highDiff = highWeights.MACHINE - highWeights.ICE;

      expect(highDiff).toBeGreaterThan(lowDiff);
    });
  });

  describe("toWeightedFragments", () => {
    it("converts MC map to weighted fragments sorted by weight", () => {
      const fragments = toWeightedFragments(testMc);

      expect(fragments.length).toBe(9); // 8 tokens + humans
      expect(fragments[fragments.length - 1].text).toContain("figures praying");
      expect(fragments[fragments.length - 1].weight).toBe(1.0);

      // Check sorting (descending by weight)
      for (let i = 0; i < fragments.length - 2; i++) {
        expect(fragments[i].weight).toBeGreaterThanOrEqual(fragments[i + 1].weight);
      }

      // Check dominance-based weighting
      // MACHINE has highest MC (1,450,000), so it should have highest weight (close to MAX_WEIGHT = 2.0)
      const machineFragment = fragments.find(f => f.text.includes("robotic automatons"));
      expect(machineFragment).toBeDefined();
      expect(machineFragment!.weight).toBeGreaterThan(1.5); // Should be close to 2.0

      // ICE has lowest MC (200,000), so it should have lowest weight (close to MIN_WEIGHT = 0.1)
      const iceFragment = fragments.find(f => f.text.includes("glaciers"));
      expect(iceFragment).toBeDefined();
      expect(iceFragment!.weight).toBeLessThan(0.5); // Should be close to 0.1

      // Verify dominance: MACHINE weight should be significantly higher than ICE
      expect(machineFragment!.weight).toBeGreaterThan(iceFragment!.weight * 3);
    });

    it("handles zero values with minimum weight", () => {
      const zeroMc: McMap = {
        CO2: 0,
        ICE: 0,
        FOREST: 0,
        NUKE: 0,
        MACHINE: 0,
        PANDEMIC: 0,
        FEAR: 0,
        HOPE: 0,
      };

      const fragments = toWeightedFragments(zeroMc);

      // All should have minimum weight (0.1)
      const tokenFragments = fragments.slice(0, -1); // Exclude human element
      for (const fragment of tokenFragments) {
        expect(fragment.weight).toBe(0.1);
      }
    });
  });

  describe("buildSDXLPrompt", () => {
    it("generates default prompt (legacy function)", () => {
      const { prompt, negative } = buildSDXLPrompt(testMc);

      expect(prompt).toContain("baroque allegorical");
      expect(negative).toContain("watermark");
    });
  });

  describe("buildGenericPayload", () => {
    it("generates structured payload with fragments", () => {
      const payload = buildGenericPayload(testMc);

      expect(payload.style).toContain("baroque allegorical");
      expect(payload.negatives).toContain("watermark");
      expect(payload.fragments).toHaveLength(9);
      expect(payload.width).toBe(1024);
      expect(payload.height).toBe(1024);
      expect(payload.steps).toBe(30);
      expect(payload.cfg).toBe(5.5);
      expect(payload.seed).toBe(42);
    });

    it("accepts custom dimensions and parameters", () => {
      const payload = buildGenericPayload(testMc, {
        width: 1024,
        height: 1024,
        steps: 50,
        cfg: 7.0,
        seed: 123,
      });

      expect(payload.width).toBe(1024);
      expect(payload.height).toBe(1024);
      expect(payload.steps).toBe(50);
      expect(payload.cfg).toBe(7.0);
      expect(payload.seed).toBe(123);
    });
  });
});
