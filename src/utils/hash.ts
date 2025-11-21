import { stableStringify } from "@/lib/pure/hash";

export { stableStringify };

export function computeStableHash(obj: unknown): string {
  const s = stableStringify(obj);
  // Simple 32-bit FNV-1a
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = (hash >>> 0) * 0x01000193;
  }
  // Return 8-hex chars
  return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
}
