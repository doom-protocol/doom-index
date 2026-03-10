/**
 * Legacy market cap rounding utility retained for compatibility tests.
 */

// Backward-compatible alias for older tests/imports
export function roundMc4<T extends Record<string, number>>(input: T): T {
  const SIX_DECIMAL_MULTIPLIER = 10 ** 6;
  const out: Record<string, number> = {};
  for (const k of Object.keys(input)) {
    const v = input[k] ?? 0;
    out[k] = Math.round(v * SIX_DECIMAL_MULTIPLIER) / SIX_DECIMAL_MULTIPLIER;
  }
  return out as T;
}

export const roundMarketCaps = roundMc4;
