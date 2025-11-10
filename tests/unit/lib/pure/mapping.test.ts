import { describe, it, expect } from "bun:test";
import { mapToVisualParams } from "@/lib/pure/mapping";
import type { TokenTicker } from "@/constants/token";

const ZERO_MAP: Record<TokenTicker, number> = {
  CO2: 0,
  ICE: 0,
  FOREST: 0,
  NUKE: 0,
  MACHINE: 0,
  PANDEMIC: 0,
  FEAR: 0,
  HOPE: 0,
};

const FULL_MAP: Record<TokenTicker, number> = {
  CO2: 1,
  ICE: 1,
  FOREST: 1,
  NUKE: 1,
  MACHINE: 1,
  PANDEMIC: 1,
  FEAR: 1,
  HOPE: 1,
};

describe("mapToVisualParams (1.1)", () => {
  it("returns deterministic baseline values when all inputs are zero", () => {
    const vp = mapToVisualParams(ZERO_MAP);
    expect(vp.fogDensity).toBe(0);
    expect(vp.skyTint).toBeCloseTo(0.15, 5);
    expect(vp.reflectivity).toBe(0);
    expect(vp.blueBalance).toBeCloseTo(0.4, 5);
    expect(vp.vegetationDensity).toBe(0);
    expect(vp.organicPattern).toBeCloseTo(0.3, 5);
    expect(vp.radiationGlow).toBe(0);
    expect(vp.debrisIntensity).toBeCloseTo(0.2, 5);
    expect(vp.mechanicalPattern).toBe(0);
    expect(vp.metallicRatio).toBeCloseTo(0.3, 5);
    expect(vp.fractalDensity).toBe(0);
    expect(vp.bioluminescence).toBeCloseTo(0.2, 5);
    expect(vp.shadowDepth).toBe(0);
    expect(vp.redHighlight).toBeCloseTo(0.3, 5);
    expect(vp.lightIntensity).toBe(0);
    expect(vp.warmHue).toBeCloseTo(0.4, 5);
  });

  it("caps all values to [0,1] even at maximum inputs", () => {
    const vp = mapToVisualParams(FULL_MAP);
    for (const value of Object.values(vp)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("responds monotonically to token influence axes", () => {
    const partial = { ...ZERO_MAP, CO2: 0.5, HOPE: 0.8 } satisfies Record<TokenTicker, number>;
    const vp = mapToVisualParams(partial);
    const vpHigherCo2 = mapToVisualParams({ ...partial, CO2: 0.9 });
    expect(vpHigherCo2.fogDensity).toBeGreaterThan(vp.fogDensity);
    expect(vpHigherCo2.skyTint).toBeGreaterThan(vp.skyTint);

    const vpHigherHope = mapToVisualParams({ ...partial, HOPE: 1 });
    expect(vpHigherHope.lightIntensity).toBeGreaterThan(vp.lightIntensity);
    expect(vpHigherHope.warmHue).toBeGreaterThan(vp.warmHue);
  });
});
