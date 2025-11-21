import { MARKET_CAP_ROUND_MULTIPLIER } from "@/constants/token";

/**
 * Round the market cap values to the configured decimal places
 * (see MARKET_CAP_ROUND_DECIMALS in @/constants/token)
 * @param input - The market cap values to round
 * @returns The rounded market cap values
 */
export function roundMc<T extends Record<string, number>>(input: T): T {
  const out: Record<string, number> = {};
  for (const k of Object.keys(input)) {
    const v = input[k] ?? 0;
    out[k] = Math.round(v * MARKET_CAP_ROUND_MULTIPLIER) / MARKET_CAP_ROUND_MULTIPLIER;
  }
  return out as T;
}

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
