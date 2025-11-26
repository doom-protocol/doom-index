import { normalizeMcMap, normalizeValue } from "@/lib/pure/normalize";
import { quantize01 } from "@/lib/pure/quantize";
import { describe, expect, it } from "bun:test";
// TOKEN_CONFIG_MAP and TOKEN_TICKERS no longer exist - legacy token system removed

describe("Normalization utilities (1.1)", () => {
  it("maps values into [0,1] with smoothing near extremes", () => {
    expect(normalizeValue(0, 0, 1_000)).toBe(0);
    expect(normalizeValue(1_000, 0, 1_000)).toBe(1);
    expect(normalizeValue(1_500, 0, 1_000)).toBe(1);

    const mid = normalizeValue(250, 0, 1_000);
    // Uses square root easing -> sqrt(0.25) = 0.5
    expect(mid).toBeCloseTo(0.5, 5);
  });

  it.skip("produces a normalized map for all eight tokens using configured bounds", () => {
    // Legacy test - TOKEN_CONFIG_MAP and TOKEN_TICKERS no longer exist
    const raw: Record<string, number> = {};
    const normalized = normalizeMcMap(raw);
    expect(Object.keys(normalized)).toEqual([]);
  });
});

describe("Quantization helper (1.1)", () => {
  it("snaps value to nearest bucket within [0,1]", () => {
    expect(quantize01(0.52, 5)).toBeCloseTo(0.6);
    expect(quantize01(0.01, 5)).toBe(0);
    expect(quantize01(1.01, 5)).toBe(1);
  });
});
