import {
  buildGenerationFileName,
  hashRoundedMap,
  hashVisualParams,
  seedForMinute,
  stableStringify,
} from "@/lib/pure/hash";
import type { VisualParams } from "@/lib/pure/mapping";
import { describe, expect, it } from "bun:test";

const createMcMap = (base: number): Record<string, number> => {
  const map: Record<string, number> = {};
  for (let i = 0; i < 8; i++) {
    map[`TOKEN${i}`] = base + i * 10;
  }
  return map;
};

const createVisualParams = (value: number): VisualParams => ({
  fogDensity: value,
  skyTint: value,
  reflectivity: value,
  blueBalance: value,
  vegetationDensity: value,
  organicPattern: value,
  radiationGlow: value,
  debrisIntensity: value,
  mechanicalPattern: value,
  metallicRatio: value,
  fractalDensity: value,
  bioluminescence: value,
  shadowDepth: value,
  redHighlight: value,
  lightIntensity: value,
  warmHue: value,
});

describe("hash tooling (1.2)", () => {
  it("stableStringify orders object keys deterministically", () => {
    const first = stableStringify({ b: 1, a: 2 });
    const second = stableStringify({ a: 2, b: 1 });
    expect(first).toBe(second);
  });

  it("hashRoundedMap produces identical hashes for equivalent maps and differs on change", async () => {
    const mapA = createMcMap(100);
    const mapB = { ...mapA };
    const hashA = await hashRoundedMap(mapA);
    const hashB = await hashRoundedMap(mapB);
    expect(hashA).toBe(hashB);

    const mapC = { ...mapA, TOKEN0: (mapA.TOKEN0 ?? 0) + 1 };
    const hashC = await hashRoundedMap(mapC);
    expect(hashC).not.toBe(hashA);
  });

  it("seedForMinute is deterministic per minute bucket and reacts to params hash", async () => {
    const minute = "2025-11-09T12:34";
    const seedA = await seedForMinute(minute, "abcd1234");
    const seedB = await seedForMinute(minute, "abcd1234");
    expect(seedA).toBe(seedB);

    const seedDifferentMinute = await seedForMinute("2025-11-09T12:35", "abcd1234");
    expect(seedDifferentMinute).not.toBe(seedA);

    const seedDifferentParams = await seedForMinute(minute, "ffffeeee");
    expect(seedDifferentParams).not.toBe(seedA);
  });

  it("hashVisualParams tolerates sub-quantization noise but reacts to material differences", async () => {
    const base = createVisualParams(0.1234);
    const noisy = { ...base, fogDensity: 0.12345 };
    const shifted = { ...base, fogDensity: 0.18 };

    const baseHash = await hashVisualParams(base);
    const noisyHash = await hashVisualParams(noisy);
    const shiftedHash = await hashVisualParams(shifted);

    expect(noisyHash).toBe(baseHash);
    expect(shiftedHash).not.toBe(baseHash);
  });

  it("buildGenerationFileName produces canonical minute-based names", async () => {
    const minute = "2025-11-09T12:34";
    const paramsHash = "aa11bb22";
    const seed = await seedForMinute(minute, paramsHash);
    const fileName = buildGenerationFileName(minute, paramsHash, seed);
    expect(fileName).toMatch(/^DOOM_\d{12}_[a-f0-9]{8}_[a-f0-9]{12}\.webp$/);
    expect(fileName).toContain(paramsHash);
    expect(fileName).toContain(seed);
    expect(fileName.includes(":")).toBe(false);
    expect(fileName.includes("-")).toBe(false);
  });
});
