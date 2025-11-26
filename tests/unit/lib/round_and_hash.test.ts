import { computeStableHash } from "@/utils/hash";
import { roundMc4 } from "@/utils/round";
import { describe, expect, it } from "bun:test";

describe("2.2 丸めとマップ構築 + ハッシュ影響検証", () => {
  it("rounds all values to 6 decimals", () => {
    const rounded = roundMc4({ AI: 1.2345678, OIL: 2.9999994 });
    expect(rounded.AI).toBe(1.234568);
    expect(rounded.OIL).toBe(2.999999);
  });

  it("differences beyond 6th decimal produce identical rounded map and identical hash", () => {
    const rawA = { AI: 1.23456789, OIL: 9.87654321 };
    const rawB = { AI: 1.23456791, OIL: 9.87654329 };
    const ra = roundMc4(rawA);
    const rb = roundMc4(rawB);
    expect(ra).toEqual(rb);
    const ha = computeStableHash(ra);
    const hb = computeStableHash(rb);
    expect(ha).toBe(hb);
  });

  it("differences at 6th decimal or larger result in different hashes after rounding", () => {
    const rawA = { AI: 1.234567 };
    const rawB = { AI: 1.234568 };
    const ra = roundMc4(rawA);
    const rb = roundMc4(rawB);
    expect(ra.AI).not.toBe(rb.AI);
    const ha = computeStableHash(ra);
    const hb = computeStableHash(rb);
    expect(ha).not.toBe(hb);
  });
});
