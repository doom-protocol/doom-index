import { TOKEN_CONFIG_MAP, TOKEN_TICKERS, type NormalizedMcMap, type TokenTicker } from "@/constants/token";

/**
 * Clamp value to [0, 1] range
 */
export const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

export function normalizeValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (max <= min) return 0;

  const clamped = Math.min(Math.max(value, min), max);
  const ratio = (clamped - min) / (max - min);
  const eased = Math.sqrt(ratio);
  return clamp01(eased);
}

export function normalizeMcMap(input: Record<string, number>): NormalizedMcMap {
  const normalized: Partial<Record<TokenTicker, number>> = {};
  for (const ticker of TOKEN_TICKERS) {
    const bounds = TOKEN_CONFIG_MAP[ticker].normalization;
    const raw = input[ticker] ?? 0;
    normalized[ticker] = normalizeValue(raw, bounds.min, bounds.max);
  }
  return normalized as NormalizedMcMap;
}
