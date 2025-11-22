import { describe, it, expect } from "bun:test";
import { getMinuteBucket } from "@/utils/time";

describe("getMinuteBucket", () => {
  it("returns the same bucket within the same minute", () => {
    const base = new Date("2025-11-09T12:34:10.123Z");
    const a = getMinuteBucket(base);
    const b = getMinuteBucket(new Date("2025-11-09T12:34:59.999Z"));
    expect(a).toBe(b);
  });

  it("returns a different bucket for a different minute", () => {
    const a = getMinuteBucket(new Date("2025-11-09T12:34:10.123Z"));
    const b = getMinuteBucket(new Date("2025-11-09T12:35:00.000Z"));
    expect(a).not.toBe(b);
  });
});
