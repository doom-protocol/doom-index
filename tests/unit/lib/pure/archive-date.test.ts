import { extractDatePrefixFromMinuteBucket, parseDatePrefix } from "@/lib/pure/painting-date";
import { describe, expect, it } from "bun:test";

describe("parseDatePrefix", () => {
  it("should parse date string to prefix structure", () => {
    expect(parseDatePrefix("2025-11-14")).toEqual({
      year: "2025",
      month: "11",
      day: "14",
      prefix: "images/2025/11/14/",
    });
  });

  it("should parse ISO timestamp to prefix structure", () => {
    expect(parseDatePrefix("2025-11-14T12:34:00Z")).toEqual({
      year: "2025",
      month: "11",
      day: "14",
      prefix: "images/2025/11/14/",
    });
  });

  it("should throw error for invalid date format", () => {
    expect(() => parseDatePrefix("invalid-date")).toThrow("Invalid date format");
  });

  it("should handle different date formats", () => {
    expect(parseDatePrefix("2025-01-01")).toEqual({
      year: "2025",
      month: "01",
      day: "01",
      prefix: "images/2025/01/01/",
    });

    expect(parseDatePrefix("2025-12-31T23:59:59Z")).toEqual({
      year: "2025",
      month: "12",
      day: "31",
      prefix: "images/2025/12/31/",
    });
  });
});

describe("extractDatePrefixFromMinuteBucket", () => {
  it("should extract date prefix from minute bucket", () => {
    expect(extractDatePrefixFromMinuteBucket("2025-11-14T12:34")).toEqual({
      year: "2025",
      month: "11",
      day: "14",
      prefix: "images/2025/11/14/",
    });
  });

  it("should handle minute bucket with seconds", () => {
    expect(extractDatePrefixFromMinuteBucket("2025-11-14T12:34:00Z")).toEqual({
      year: "2025",
      month: "11",
      day: "14",
      prefix: "images/2025/11/14/",
    });
  });
});
