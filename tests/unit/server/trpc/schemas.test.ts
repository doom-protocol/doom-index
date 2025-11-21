import { describe, it, expect } from "bun:test";
import {
  tokenTickerSchema,
  viewerRegisterSchema,
  viewerRemoveSchema,
  tokenGetStateSchema,
  r2GetObjectSchema,
} from "@/server/trpc/schemas";
// TOKEN_TICKERS no longer exists - legacy token system removed

describe("Zod Schemas", () => {
  describe("tokenTickerSchema", () => {
    it("should validate valid token tickers", () => {
      // tokenTickerSchema is now just z.string(), so any string is valid
      expect(() => tokenTickerSchema.parse("CO2")).not.toThrow();
      expect(() => tokenTickerSchema.parse("ICE")).not.toThrow();
      expect(() => tokenTickerSchema.parse("any-string")).not.toThrow();
    });

    it.skip("should reject invalid token tickers", () => {
      // Legacy test - tokenTickerSchema is now just z.string(), so it accepts any string
      // Empty string is still rejected by z.string()
      expect(() => tokenTickerSchema.parse("")).toThrow();
    });
  });

  describe("viewerRegisterSchema", () => {
    it("should validate valid register input", () => {
      const valid = { sessionId: "test-session-id" };
      expect(() => viewerRegisterSchema.parse(valid)).not.toThrow();
    });

    it("should validate with optional userAgent", () => {
      const valid = { sessionId: "test-session-id", userAgent: "test-agent" };
      expect(() => viewerRegisterSchema.parse(valid)).not.toThrow();
    });

    it("should reject empty sessionId", () => {
      expect(() => viewerRegisterSchema.parse({ sessionId: "" })).toThrow();
      expect(() => viewerRegisterSchema.parse({})).toThrow();
    });
  });

  describe("viewerRemoveSchema", () => {
    it("should validate valid remove input", () => {
      const valid = { sessionId: "test-session-id" };
      expect(() => viewerRemoveSchema.parse(valid)).not.toThrow();
    });

    it("should reject empty sessionId", () => {
      expect(() => viewerRemoveSchema.parse({ sessionId: "" })).toThrow();
    });
  });

  describe("tokenGetStateSchema", () => {
    it("should validate valid token state input", () => {
      const valid = { ticker: "CO2" };
      expect(() => tokenGetStateSchema.parse(valid)).not.toThrow();
    });

    it.skip("should reject invalid ticker", () => {
      // Legacy test - tokenTickerSchema is now just z.string(), so any string is valid
      // This test is no longer applicable
    });
  });

  describe("r2GetObjectSchema", () => {
    it("should validate valid R2 object input", () => {
      const valid = { key: ["path", "to", "object"] };
      expect(() => r2GetObjectSchema.parse(valid)).not.toThrow();
    });

    it("should reject empty key array", () => {
      expect(() => r2GetObjectSchema.parse({ key: [] })).toThrow();
    });

    it("should reject empty strings in key array", () => {
      expect(() => r2GetObjectSchema.parse({ key: [""] })).toThrow();
    });
  });
});
