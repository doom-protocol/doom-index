import { describe, it, expect } from "bun:test";
import { getMinuteBucket, getIntervalBucket } from "@/utils/time";

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

describe("getIntervalBucket", () => {
  it("returns the same bucket within the same 10-minute interval", () => {
    const base = new Date("2025-11-09T12:30:00.000Z");
    const a = getIntervalBucket(base, 600000); // 10 minutes
    const b = getIntervalBucket(new Date("2025-11-09T12:35:59.999Z"), 600000);
    expect(a).toBe(b);
    expect(a).toBe("2025-11-09T12:30");
  });

  it("returns a different bucket for a different 10-minute interval", () => {
    const a = getIntervalBucket(new Date("2025-11-09T12:35:00.000Z"), 600000);
    const b = getIntervalBucket(new Date("2025-11-09T12:40:00.000Z"), 600000);
    expect(a).not.toBe(b);
    expect(a).toBe("2025-11-09T12:30");
    expect(b).toBe("2025-11-09T12:40");
  });

  it("works with different interval sizes", () => {
    // 5-minute intervals
    const a = getIntervalBucket(new Date("2025-11-09T12:32:00.000Z"), 300000);
    const b = getIntervalBucket(new Date("2025-11-09T12:35:00.000Z"), 300000);
    expect(a).toBe("2025-11-09T12:30");
    expect(b).toBe("2025-11-09T12:35");
  });

  it("defaults to 10-minute intervals when no interval specified", () => {
    const bucket = getIntervalBucket(new Date("2025-11-09T12:35:00.000Z"));
    expect(bucket).toBe("2025-11-09T12:30");
  });
});
