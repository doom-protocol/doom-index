import {
  paintingsListSchema,
  r2GetObjectSchema,
  tokenStateInputSchema,
  tokenTickerInputSchema,
  viewerRegisterSchema,
  viewerRemoveSchema,
} from "@/server/trpc/schemas";
import { describe, expect, it } from "bun:test";
import * as v from "valibot";

describe("Valibot Schemas", () => {
  describe("tokenTickerInputSchema", () => {
    it("should validate valid token tickers", () => {
      expect(() => v.parse(tokenTickerInputSchema, "CO2")).not.toThrow();
      expect(() => v.parse(tokenTickerInputSchema, "ICE")).not.toThrow();
      expect(() => v.parse(tokenTickerInputSchema, "any-string")).not.toThrow();
    });

    it("should reject non-strings", () => {
      expect(() => v.parse(tokenTickerInputSchema, 123)).toThrow();
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

  describe("tokenStateInputSchema", () => {
    it("should validate valid token state input", () => {
      const valid = { ticker: "CO2" };
      expect(() => v.parse(tokenStateInputSchema, valid)).not.toThrow();
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

  describe("paintingsListSchema", () => {
    it("should validate valid input with limit, cursor, and valid date range", () => {
      const valid = {
        limit: 50,
        cursor: "cursor123",
        from: "2024-01-01",
        to: "2024-12-31",
      };
      expect(() => v.parse(paintingsListSchema, valid)).not.toThrow();
    });

    it("should validate with partial optional fields", () => {
      const valid = { limit: 25 };
      expect(() => v.parse(paintingsListSchema, valid)).not.toThrow();
    });

    it("should validate empty object", () => {
      expect(() => v.parse(paintingsListSchema, {})).not.toThrow();
    });

    it("should reject invalid date format", () => {
      expect(() => v.parse(paintingsListSchema, { from: "01-01-2024" })).toThrow();
      expect(() => v.parse(paintingsListSchema, { to: "2024/01/01" })).toThrow();
    });

    it("should reject from date after to date", () => {
      const invalid = {
        from: "2024-12-31",
        to: "2024-01-01",
      };
      expect(() => v.parse(paintingsListSchema, invalid)).toThrow();
    });

    it("should reject invalid limit values", () => {
      expect(() => v.parse(paintingsListSchema, { limit: 0 })).toThrow();
      expect(() => v.parse(paintingsListSchema, { limit: 101 })).toThrow();
      expect(() => v.parse(paintingsListSchema, { limit: 3.5 })).toThrow();
    });
  });
});
