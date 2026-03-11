import { describe, expect, it } from "bun:test";
import { requirePositiveNumberEnv } from "@/env";

describe("unit/env/requirePositiveNumberEnv", () => {
  it("returns a finite positive number as-is", () => {
    expect(requirePositiveNumberEnv("NEXT_PUBLIC_GENERATION_INTERVAL_MS", 600000)).toBe(600000);
  });

  it("parses a numeric string", () => {
    expect(requirePositiveNumberEnv("NEXT_PUBLIC_GENERATION_INTERVAL_MS", "3600000")).toBe(3600000);
  });

  it("throws when the value is missing or invalid", () => {
    expect(() => requirePositiveNumberEnv("NEXT_PUBLIC_GENERATION_INTERVAL_MS", undefined)).toThrow(
      "NEXT_PUBLIC_GENERATION_INTERVAL_MS must be a positive number",
    );
    expect(() => requirePositiveNumberEnv("NEXT_PUBLIC_GENERATION_INTERVAL_MS", "abc")).toThrow(
      "NEXT_PUBLIC_GENERATION_INTERVAL_MS must be a positive number",
    );
    expect(() => requirePositiveNumberEnv("NEXT_PUBLIC_GENERATION_INTERVAL_MS", 0)).toThrow(
      "NEXT_PUBLIC_GENERATION_INTERVAL_MS must be a positive number",
    );
  });
});
