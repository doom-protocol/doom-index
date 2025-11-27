import {
  createSignedUploadUrlSchema,
  paintingsListSchema,
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

  describe("createSignedUploadUrlSchema", () => {
    it("should validate valid payload with all fields", () => {
      const valid = {
        filename: "painting.glb",
        contentType: "application/octet-stream",
        keyvalues: {
          walletAddress: "abc123",
          timestamp: "2024-01-01T00:00:00Z",
          paintingHash: "hash123",
          network: "mainnet-beta",
        },
      };
      expect(() => v.parse(createSignedUploadUrlSchema, valid)).not.toThrow();
    });

    it("should validate with minimal required fields", () => {
      const valid = {
        filename: "test.json",
        contentType: "application/json",
        keyvalues: {
          timestamp: "2024-01-01T00:00:00Z",
          paintingHash: "hash123",
          network: "devnet",
        },
      };
      expect(() => v.parse(createSignedUploadUrlSchema, valid)).not.toThrow();
    });

    it("should validate without optional keyvalues", () => {
      const valid = {
        filename: "file.bin",
        contentType: "application/octet-stream",
      };
      expect(() => v.parse(createSignedUploadUrlSchema, valid)).not.toThrow();
    });

    it("should reject empty filename", () => {
      expect(() => v.parse(createSignedUploadUrlSchema, {
        filename: "",
        contentType: "application/octet-stream",
      })).toThrow();
    });

    it("should reject filename too long", () => {
      const longFilename = "a".repeat(256);
      expect(() => v.parse(createSignedUploadUrlSchema, {
        filename: longFilename,
        contentType: "application/octet-stream",
      })).toThrow();
    });

    it("should reject disallowed contentType", () => {
      expect(() => v.parse(createSignedUploadUrlSchema, {
        filename: "file.txt",
        contentType: "text/plain",
      })).toThrow();
    });

    it("should reject missing required keyvalues fields", () => {
      const missingTimestamp = {
        filename: "file.bin",
        contentType: "application/octet-stream",
        keyvalues: {
          paintingHash: "hash123",
          network: "devnet",
        },
      };
      expect(() => v.parse(createSignedUploadUrlSchema, missingTimestamp)).toThrow();

      const missingPaintingHash = {
        filename: "file.bin",
        contentType: "application/octet-stream",
        keyvalues: {
          timestamp: "2024-01-01T00:00:00Z",
          network: "devnet",
        },
      };
      expect(() => v.parse(createSignedUploadUrlSchema, missingPaintingHash)).toThrow();

      const missingNetwork = {
        filename: "file.bin",
        contentType: "application/octet-stream",
        keyvalues: {
          timestamp: "2024-01-01T00:00:00Z",
          paintingHash: "hash123",
        },
      };
      expect(() => v.parse(createSignedUploadUrlSchema, missingNetwork)).toThrow();
    });

    it("should reject invalid network", () => {
      const invalidNetwork = {
        filename: "file.bin",
        contentType: "application/octet-stream",
        keyvalues: {
          timestamp: "2024-01-01T00:00:00Z",
          paintingHash: "hash123",
          network: "invalid-network",
        },
      };
      expect(() => v.parse(createSignedUploadUrlSchema, invalidNetwork)).toThrow();
    });
  });
});
