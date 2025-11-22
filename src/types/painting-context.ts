/**
 * Painting Context Types
 *
 * Types for dynamic-draw painting context generation.
 * Based on dynamic-draw requirements specification.
 */

export type MarketClimate = "euphoria" | "cooling" | "despair" | "panic" | "transition";

export type TokenArchetype =
  | "perp-liquidity"
  | "meme-ascendant"
  | "l1-sovereign"
  | "privacy"
  | "ai-oracle"
  | "political"
  | "unknown";

export type EventKind = "rally" | "collapse" | "ritual";

export type EventIntensity = 1 | 2 | 3;

export type Composition = "citadel-panorama" | "procession" | "central-altar" | "storm-battlefield" | "cosmic-horizon";

export type Palette = "solar-gold" | "ashen-blue" | "infernal-red" | "ivory-marble";

export type TrendDirection = "up" | "down" | "flat";

export type VolatilityLevel = "low" | "medium" | "high" | "extreme";

export type MotifTag = string; // e.g., "pump-fun", "official-meme", "no-vc"

/**
 * Painting context for dynamic-draw
 * Contains all visual and narrative parameters for prompt generation
 */
export interface PaintingContext {
  t: { n: string; c: string }; // token name / chain
  m: { mc: number; bd: number; fg: number | null }; // market snapshot
  s: { p: number; p7: number; v: number; mc: number; vol: number }; // token snapshot
  c: MarketClimate;
  a: TokenArchetype;
  e: { k: EventKind; i: EventIntensity };
  o: Composition;
  p: Palette;
  d: { dir: TrendDirection; vol: VolatilityLevel };
  f: MotifTag[];
  h: string[]; // narrative hints
}
