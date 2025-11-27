import {
  r2GetObjectSchema,
  tokenGetStateSchema,
  tokenTickerSchema,
  viewerRegisterSchema,
  viewerRemoveSchema,
} from "@/server/trpc/schemas";
import { describe, expect, it } from "bun:test";
import * as v from "valibot";

describe("Valibot Schemas", () => {
  describe("tokenTickerSchema", () => {
    it("should validate valid token tickers", () => {
      // tokenTickerSchema is now just v.string(), so any string is valid
      expect(() => v.parse(tokenTickerSchema, "CO2")).not.toThrow();
      expect(() => v.parse(tokenTickerSchema, "ICE")).not.toThrow();
      expect(() => v.parse(tokenTickerSchema, "any-string")).not.toThrow();
    });

    it("should reject non-strings", () => {
      expect(() => v.parse(tokenTickerSchema, 123)).toThrow();
    });
  });

  describe("viewerRegisterSchema", () => {
    it("should validate valid register input", () => {
      const valid = { sessionId: "test-session-id" };
      expect(() => v.parse(viewerRegisterSchema, valid)).not.toThrow();
    });

    it("should validate with optional userAgent", () => {
      const valid = { sessionId: "test-session-id", userAgent: "test-agent" };
      expect(() => v.parse(viewerRegisterSchema, valid)).not.toThrow();
    });

    it("should reject empty sessionId", () => {
      expect(() => v.parse(viewerRegisterSchema, { sessionId: "" })).toThrow();
      expect(() => v.parse(viewerRegisterSchema, {})).toThrow();
    });
  });

  describe("viewerRemoveSchema", () => {
    it("should validate valid remove input", () => {
      const valid = { sessionId: "test-session-id" };
      expect(() => v.parse(viewerRemoveSchema, valid)).not.toThrow();
    });

    it("should reject empty sessionId", () => {
      expect(() => v.parse(viewerRemoveSchema, { sessionId: "" })).toThrow();
    });
  });

  describe("tokenGetStateSchema", () => {
    it("should validate valid token state input", () => {
      const valid = { ticker: "CO2" };
      expect(() => v.parse(tokenGetStateSchema, valid)).not.toThrow();
    });
  });

  describe("r2GetObjectSchema", () => {
    it("should validate valid R2 object input", () => {
      const valid = { key: ["path", "to", "object"] };
      expect(() => v.parse(r2GetObjectSchema, valid)).not.toThrow();
    });

    it("should reject empty key array", () => {
      expect(() => v.parse(r2GetObjectSchema, { key: [] })).toThrow();
    });

    it("should reject empty strings in key array", () => {
      expect(() => v.parse(r2GetObjectSchema, { key: [""] })).toThrow();
    });
  });
});
