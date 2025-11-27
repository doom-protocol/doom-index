import { QUANTIZE_DECIMALS, type NormalizedMcMap } from "@/constants/token";
import type { VisualParams } from "@/lib/pure/mapping";

const encoder = new TextEncoder();

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashRoundedMap(map: NormalizedMcMap | Record<string, number>): Promise<string> {
  const serialized = stableStringify(map);
  const digest = await sha256Hex(serialized);
  return digest.slice(0, 16);
}

const quantize = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(Math.max(value, 0), 1);
  const factor = 10 ** QUANTIZE_DECIMALS;
  return Math.round(clamped * factor) / factor;
};

export async function hashVisualParams(params: VisualParams): Promise<string> {
  const serialized = Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => {
      if (typeof value === "number") {
        return `${key}:${quantize(value).toFixed(QUANTIZE_DECIMALS)}`;
      } else if (typeof value === "string") {
        return `${key}:${value}`;
      } else if (typeof value === "object" && value !== null) {
        return `${key}:${stableStringify(value)}`;
      } else {
        return `${key}:${String(value)}`;
      }
    })
    .join("|");
  const digest = await sha256Hex(serialized);
  return digest.slice(0, 8);
}

export async function seedForMinute(minuteIso: string, paramsHash: string): Promise<string> {
  const payload = `${minuteIso}|${paramsHash.toLowerCase()}`;
  const digest = await sha256Hex(payload);
  return digest.slice(0, 12);
}

export function buildGenerationFileName(minuteIso: string, paramsHash: string, seed: string): string {
  const minuteDigits = minuteIso.replace(/\D/g, "").slice(0, 12);
  const sanitizedParams = paramsHash.toLowerCase();
  const sanitizedSeed = seed.toLowerCase();
  return `DOOM_${minuteDigits}_${sanitizedParams}_${sanitizedSeed}.webp`;
}
