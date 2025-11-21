/**
 * Painting Context Types
 *
 * Types for dynamic-draw painting context generation.
 * Based on dynamic-draw requirements specification.
 */

export type MarketClimate = "bullish" | "bearish" | "neutral" | "volatile" | "graveyard" | "unknown";

export type TokenArchetype =
  | "blue-chip"
  | "meme"
  | "utility"
  | "governance"
  | "nft"
  | "defi"
  | "layer1"
  | "layer2"
  | "unknown";

export type EventKind = "launch" | "pump" | "dump" | "consolidation" | "breakout" | "none";

export type EventIntensity = "low" | "medium" | "high" | "extreme";

export type Composition = "portrait" | "landscape" | "still-life" | "abstract" | "narrative";

export type Palette = "warm" | "cool" | "monochrome" | "vibrant" | "muted" | "high-contrast";

export type TrendDirection = "up" | "down" | "sideways";

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
