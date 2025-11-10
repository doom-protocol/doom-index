import { describe, it, expect } from "bun:test";
import { normalizeValue, normalizeMcMap } from "@/lib/pure/normalize";
import { quantize01 } from "@/lib/pure/quantize";
import { TOKEN_CONFIG_MAP, TOKEN_TICKERS } from "@/constants/token";

describe("Normalization utilities (1.1)", () => {
  it("maps values into [0,1] with smoothing near extremes", () => {
    expect(normalizeValue(0, 0, 1_000)).toBe(0);
    expect(normalizeValue(1_000, 0, 1_000)).toBe(1);
    expect(normalizeValue(1_500, 0, 1_000)).toBe(1);

    const mid = normalizeValue(250, 0, 1_000);
    // Uses square root easing -> sqrt(0.25) = 0.5
    expect(mid).toBeCloseTo(0.5, 5);
  });

  it("produces a normalized map for all eight tokens using configured bounds", () => {
    const raw: Record<string, number> = {};
    for (const ticker of TOKEN_TICKERS) {
      const bounds = TOKEN_CONFIG_MAP[ticker].normalization;
      raw[ticker] = bounds.max;
    }

    const normalized = normalizeMcMap(raw);
    expect(Object.keys(normalized)).toEqual([...TOKEN_TICKERS]);
    for (const ticker of TOKEN_TICKERS) {
      expect(normalized[ticker]).toBe(1);
    }
  });
});

describe("Quantization helper (1.1)", () => {
  it("snaps value to nearest bucket within [0,1]", () => {
    expect(quantize01(0.52, 5)).toBeCloseTo(0.6);
    expect(quantize01(0.01, 5)).toBe(0);
    expect(quantize01(1.01, 5)).toBe(1);
  });
});
