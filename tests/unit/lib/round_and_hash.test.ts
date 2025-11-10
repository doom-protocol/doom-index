import { describe, it, expect } from "bun:test";
import { roundMc4 } from "@/lib/round";
import { computeStableHash } from "@/lib/hash";

describe("2.2 丸めとマップ構築 + ハッシュ影響検証", () => {
  it("rounds all values to 4 decimals", () => {
    const rounded = roundMc4({ AI: 1.23456, OIL: 2.99994 });
    expect(rounded.AI).toBe(1.2346);
    expect(rounded.OIL).toBe(2.9999);
  });

  it("differences beyond 4th decimal produce identical rounded map and identical hash", () => {
    const rawA = { AI: 1.234539, OIL: 9.87654 };
    const rawB = { AI: 1.234541, OIL: 9.876549 };
    const ra = roundMc4(rawA);
    const rb = roundMc4(rawB);
    expect(ra).toEqual(rb);
    const ha = computeStableHash(ra);
    const hb = computeStableHash(rb);
    expect(ha).toBe(hb);
  });

  it("differences at 4th decimal or larger result in different hashes after rounding", () => {
    const rawA = { AI: 1.2344 };
    const rawB = { AI: 1.2345 };
    const ra = roundMc4(rawA);
    const rb = roundMc4(rawB);
    expect(ra.AI).not.toBe(rb.AI);
    const ha = computeStableHash(ra);
    const hb = computeStableHash(rb);
    expect(ha).not.toBe(hb);
  });
});
