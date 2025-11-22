/**
 * Number of decimal places to quantize visual parameters
 * Used for hashing visual parameters to create a stable seed
 */
export const QUANTIZE_DECIMALS = 3;

export type NormalizedMcMap = Record<string, number>;
export type McMap = Record<string, number>;
