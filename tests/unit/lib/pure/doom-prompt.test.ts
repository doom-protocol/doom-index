import { describe, it, expect } from "bun:test";
import { toWeightedFragments, buildSDXLPrompt, buildGenericPayload } from "@/lib/pure/doom-prompt";
import type { McMap } from "@/constants/token";

describe("Doom Prompt Generation", () => {
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

  describe("toWeightedFragments", () => {
    it("converts MC map to weighted fragments sorted by weight", () => {
      const fragments = toWeightedFragments(testMc);

      expect(fragments.length).toBe(9); // 8 tokens + humans
      expect(fragments[fragments.length - 1].text).toContain("medieval figures");
      expect(fragments[fragments.length - 1].weight).toBe(1.0);

      // Check sorting (descending by weight)
      for (let i = 0; i < fragments.length - 2; i++) {
        expect(fragments[i].weight).toBeGreaterThanOrEqual(fragments[i + 1].weight);
      }

      // Check weight normalization (threshold = 1M)
      const machineFragment = fragments.find(f => f.text.includes("machine"));
      expect(machineFragment?.weight).toBeCloseTo(1.45, 2);

      const iceFragment = fragments.find(f => f.text.includes("glaciers"));
      expect(iceFragment?.weight).toBeCloseTo(0.2, 2);
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

      // All should have minimum weight (0.01)
      const tokenFragments = fragments.slice(0, -1); // Exclude human element
      for (const fragment of tokenFragments) {
        expect(fragment.weight).toBe(0.01);
      }
    });
  });

  describe("buildSDXLPrompt", () => {
    it("generates SDXL-style prompt with bracket weights", () => {
      const { prompt, negative } = buildSDXLPrompt(testMc);

      expect(prompt).toContain("medieval allegorical oil painting");
      expect(prompt).toContain("Bosch and Bruegel");
      expect(prompt).toContain("chiaroscuro lighting");

      // Check weighted format: (phrase:weight)
      expect(prompt).toMatch(/\([^:]+:\d+\.\d{2}\)/);

      // Check negative prompt
      expect(negative).toContain("watermark");
      expect(negative).toContain("low detail hands");
    });

    it("includes all token elements in the prompt", () => {
      const { prompt } = buildSDXLPrompt(testMc);

      expect(prompt).toContain("smog");
      expect(prompt).toContain("glaciers");
      expect(prompt).toContain("forests");
      expect(prompt).toContain("nuclear");
      expect(prompt).toContain("machine");
      expect(prompt).toContain("spores");
      expect(prompt).toContain("darkness");
      expect(prompt).toContain("light");
      expect(prompt).toContain("medieval figures");
    });
  });

  describe("buildGenericPayload", () => {
    it("generates structured payload with fragments", () => {
      const payload = buildGenericPayload(testMc);

      expect(payload.style).toContain("medieval renaissance");
      expect(payload.negatives).toContain("watermark");
      expect(payload.fragments).toHaveLength(9);
      expect(payload.width).toBe(1280);
      expect(payload.height).toBe(720);
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
