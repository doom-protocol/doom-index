import { describe, it, expect } from "bun:test";
import { TOKENS, TOKEN_CONFIG_MAP, TOKEN_TICKERS, type TokenTicker, type VisualParamKey } from "@/constants/token";

const EXPECTED_AXES: Record<TokenTicker, [VisualParamKey, VisualParamKey]> = {
  CO2: ["fogDensity", "skyTint"],
  ICE: ["reflectivity", "blueBalance"],
  FOREST: ["vegetationDensity", "organicPattern"],
  NUKE: ["radiationGlow", "debrisIntensity"],
  MACHINE: ["mechanicalPattern", "metallicRatio"],
  PANDEMIC: ["fractalDensity", "bioluminescence"],
  FEAR: ["shadowDepth", "redHighlight"],
  HOPE: ["lightIntensity", "warmHue"],
};

describe("Token configuration (1.1)", () => {
  it("declares exactly eight configured tokens with unique tickers", () => {
    expect(TOKENS).toHaveLength(8);
    const uniqueTickers = new Set(TOKENS.map(token => token.ticker));
    expect(uniqueTickers.size).toBe(8);
    expect([...uniqueTickers]).toEqual([...TOKEN_TICKERS]);
  });

  it("exposes token metadata with supply, address, and axis pairs", () => {
    for (const ticker of TOKEN_TICKERS) {
      const config = TOKEN_CONFIG_MAP[ticker];
      expect(config).toBeDefined();
      expect(typeof config.address).toBe("string");
      expect(config.address.length).toBeGreaterThan(10);
      expect(config.supply).toBeGreaterThan(0);

      const axes = config.axes;
      expect(axes).toEqual(EXPECTED_AXES[ticker]);
    }
  });
});
