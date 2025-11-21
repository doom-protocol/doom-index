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

/**
 * Legacy function: normalizeMcMap
 * @deprecated This function is part of the legacy 8-token system and should not be used.
 * It returns an empty object for backward compatibility.
 */
export function normalizeMcMap(_input: Record<string, number>): Record<string, number> {
  // Legacy system is deprecated - return empty map
  return {};
}
