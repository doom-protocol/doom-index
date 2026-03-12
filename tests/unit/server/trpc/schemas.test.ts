import { paintingsListSchema, viewerRegisterSchema, viewerRemoveSchema } from "@/server/trpc/schemas";
import { describe, expect, it } from "bun:test";
import * as v from "valibot";

describe("Valibot Schemas", () => {
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
