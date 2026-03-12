import { describe, expect, it } from "bun:test";

import {
  DEFAULT_PUBLIC_GENERATION_INTERVAL_MS,
  DEFAULT_PUBLIC_LOG_LEVEL,
  parsePublicGenerationIntervalMs,
  parsePublicLogLevel,
  readBaseUrlDevelopment,
  readHostnameDevelopment,
} from "@/utils/public-env";

describe("unit/utils/public-env", () => {
  it("returns the default generation interval when the public env is missing", () => {
    expect(parsePublicGenerationIntervalMs(undefined)).toBe(DEFAULT_PUBLIC_GENERATION_INTERVAL_MS);
  });

  it("returns the default generation interval when the public env is invalid", () => {
    expect(parsePublicGenerationIntervalMs("not-a-number")).toBe(DEFAULT_PUBLIC_GENERATION_INTERVAL_MS);
    expect(parsePublicGenerationIntervalMs("0")).toBe(DEFAULT_PUBLIC_GENERATION_INTERVAL_MS);
  });

  it("normalizes the public log level and falls back safely", () => {
    expect(parsePublicLogLevel("debug")).toBe("DEBUG");
    expect(parsePublicLogLevel("WARN")).toBe("WARN");
    expect(parsePublicLogLevel("invalid")).toBe(DEFAULT_PUBLIC_LOG_LEVEL);
  });

  it("treats localhost base URLs as development without strict env validation", () => {
    expect(readBaseUrlDevelopment("http://localhost:8787")).toBe(true);
    expect(readBaseUrlDevelopment("https://doomindex.fun")).toBe(false);
    expect(readBaseUrlDevelopment(undefined)).toBe(false);
  });

  it("treats loopback hostnames as development", () => {
    expect(readHostnameDevelopment("localhost")).toBe(true);
    expect(readHostnameDevelopment("127.0.0.1")).toBe(true);
    expect(readHostnameDevelopment("192.168.11.59")).toBe(false);
  });
});
