import { stableStringify } from "@/lib/pure/hash";

export function computeStableHash(obj: unknown): string {
  const s = stableStringify(obj);
  // Simple 32-bit FNV-1a
  let hash = 2_166_136_261;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = (hash >>> 0) * 16_777_619;
  }
  // Return 8-hex chars
  return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
}
