import type {
  MarketClimate,
  TokenArchetype,
  EventKind,
  EventIntensity,
  Composition,
  Palette,
  TrendDirection,
  VolatilityLevel,
  MotifTag,
} from "@/types/painting-context";
import type { MarketSnapshot, SelectedToken, TokenSnapshot } from "@/types/paintings";

/**
 * Classification Functions for PaintingContext
 * Pure functions for deterministic classification
 * Requirement 5
 */

/**
 * Classify Market Climate (Requirement 5)
 */
export function classifyMarketClimate(snapshot: MarketSnapshot): MarketClimate {
  const mc = snapshot.marketCapChangePercentage24hUsd;
  const fg = snapshot.fearGreedIndex;

  if (mc > 3 && fg !== null && fg >= 70) {
    return "euphoria";
  } else if (mc > 0.5) {
    return "cooling";
  } else if (mc < -5) {
    return "despair";
  } else if (mc < -1.5) {
    return "panic";
  } else {
    return "transition";
  }
}

/**
 * Classify Token Archetype (Requirement 5)
 */
export function classifyTokenArchetype(token: SelectedToken, categories: string[]): TokenArchetype {
  if (categories.includes("perp")) {
    return "perp-liquidity";
  } else if (categories.includes("meme")) {
    return "meme-ascendant";
  } else if (categories.includes("l1") || categories.includes("layer-1")) {
    return "l1-sovereign";
  } else if (categories.includes("privacy")) {
    return "privacy";
  } else if (categories.includes("ai") || categories.includes("artificial-intelligence")) {
    return "ai-oracle";
  } else if (categories.includes("political")) {
    return "political";
  } else {
    return "unknown";
  }
}

/**
 * Classify Event Pressure (Requirement 5)
 */
export function classifyEventPressure(tokenSnapshot: TokenSnapshot): { k: EventKind; i: EventIntensity } {
  const priceChange24h = tokenSnapshot.p;

  if (priceChange24h > 10) {
    return { k: "rally", i: 3 };
  } else if (priceChange24h < -10) {
    return { k: "collapse", i: 3 };
  } else if (priceChange24h > 5) {
    return { k: "rally", i: 2 };
  } else if (priceChange24h < -5) {
    return { k: "collapse", i: 2 };
  } else {
    return { k: "ritual", i: 1 };
  }
}

/**
 * Pick Composition (Requirement 5)
 */
export function pickComposition(
  climate: MarketClimate,
  archetype: TokenArchetype,
  event: { k: EventKind; i: EventIntensity },
): Composition {
  if (archetype === "perp-liquidity" && event.k === "rally") {
    return "citadel-panorama";
  } else if (archetype === "meme-ascendant" && event.k === "rally") {
    return "procession";
  } else if (climate === "euphoria") {
    return "central-altar";
  } else if (climate === "despair") {
    return "storm-battlefield";
  } else {
    return "cosmic-horizon";
  }
}

/**
 * Pick Palette (Requirement 5)
 */
export function pickPalette(
  climate: MarketClimate,
  archetype: TokenArchetype,
  event: { k: EventKind; i: EventIntensity },
): Palette {
  if (climate === "euphoria") {
    return "solar-gold";
  } else if (climate === "panic" || climate === "despair") {
    return "ashen-blue";
  } else if (archetype === "meme-ascendant" && event.k === "rally") {
    return "infernal-red";
  } else {
    return "ivory-marble";
  }
}

/**
 * Classify Dynamics (Requirement 5)
 */
export function classifyDynamics(tokenSnapshot: TokenSnapshot): { dir: TrendDirection; vol: VolatilityLevel } {
  const priceChange24h = tokenSnapshot.p;
  const volatilityScore = tokenSnapshot.vol;

  let dir: TrendDirection;
  if (priceChange24h > 3) {
    dir = "up";
  } else if (priceChange24h < -3) {
    dir = "down";
  } else {
    dir = "flat";
  }

  let vol: VolatilityLevel;
  if (volatilityScore > 0.66) {
    vol = "high";
  } else if (volatilityScore > 0.33) {
    vol = "medium";
  } else {
    vol = "low";
  }

  return { dir, vol };
}

/**
 * Derive Motifs (Requirement 5)
 */
export function deriveMotifs(archetype: TokenArchetype): MotifTag[] {
  switch (archetype) {
    case "perp-liquidity":
      return ["temple", "wheel-of-liquidity", "pillar"];
    case "meme-ascendant":
      return ["crowd", "idol"];
    case "privacy":
      return ["mask", "graveyard"];
    default:
      return ["unknown"];
  }
}

/**
 * Derive Narrative Hints (Requirement 5)
 */
export function deriveNarrativeHints(climate: MarketClimate, event: { k: EventKind; i: EventIntensity }): string[] {
  const hints: string[] = [];

  // Climate-based hints
  switch (climate) {
    case "euphoria":
      hints.push("collective celebration", "rising tide");
      break;
    case "panic":
      hints.push("mass exodus", "fear spreads");
      break;
    case "despair":
      hints.push("deepening shadows", "lost hope");
      break;
    case "cooling":
      hints.push("calming winds", "settling dust");
      break;
    case "transition":
      hints.push("shifting currents", "uncertain path");
      break;
  }

  // Event-based hints
  switch (event.k) {
    case "rally":
      hints.push(`momentum building (intensity ${event.i})`);
      break;
    case "collapse":
      hints.push(`foundation crumbling (intensity ${event.i})`);
      break;
    case "ritual":
      hints.push("steady rhythm", "enduring pattern");
      break;
  }

  return hints;
}
