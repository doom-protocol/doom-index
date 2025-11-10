/**
 * Tests for Image Utility Functions
 *
 * Validates:
 * - ArrayBuffer to base64 data URL conversion
 * - Different MIME type handling
 * - Edge cases (empty buffer, binary data)
 */

import { describe, expect, test } from "bun:test";
import { arrayBufferToDataUrl } from "@/utils/image";

describe("Image Utilities", () => {
  describe("arrayBufferToDataUrl", () => {
    test("should convert ArrayBuffer to base64 data URL", () => {
      const testData = "test image data";
      const encoder = new TextEncoder();
      const buffer = encoder.encode(testData).buffer;

      const dataUrl = arrayBufferToDataUrl(buffer, "image/webp");

      expect(dataUrl).toStartWith("data:image/webp;base64,");

      // Verify base64 encoding
      const base64Part = dataUrl.split(",")[1];
      const decoded = Buffer.from(base64Part, "base64").toString();
      expect(decoded).toBe(testData);
    });

    test("should handle different mime types", () => {
      const testData = "png data";
      const encoder = new TextEncoder();
      const buffer = encoder.encode(testData).buffer;

      const webpUrl = arrayBufferToDataUrl(buffer, "image/webp");
      const pngUrl = arrayBufferToDataUrl(buffer, "image/png");
      const jpegUrl = arrayBufferToDataUrl(buffer, "image/jpeg");

      expect(webpUrl).toStartWith("data:image/webp;base64,");
      expect(pngUrl).toStartWith("data:image/png;base64,");
      expect(jpegUrl).toStartWith("data:image/jpeg;base64,");
    });

    test("should handle empty buffer", () => {
      const buffer = new ArrayBuffer(0);
      const dataUrl = arrayBufferToDataUrl(buffer, "image/webp");

      expect(dataUrl).toBe("data:image/webp;base64,");
    });

    test("should handle binary data correctly", () => {
      // Create a buffer with JPEG magic bytes
      const binaryData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const buffer = binaryData.buffer;

      const dataUrl = arrayBufferToDataUrl(buffer, "image/jpeg");

      expect(dataUrl).toStartWith("data:image/jpeg;base64,");

      // Verify binary data is preserved
      const base64Part = dataUrl.split(",")[1];
      const decoded = Buffer.from(base64Part, "base64");
      expect(Array.from(new Uint8Array(decoded))).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    });

    test("should handle large buffers", () => {
      // Create a larger buffer (1KB)
      const largeData = new Uint8Array(1024).fill(42);
      const buffer = largeData.buffer;

      const dataUrl = arrayBufferToDataUrl(buffer, "image/png");

      expect(dataUrl).toStartWith("data:image/png;base64,");
      expect(dataUrl.length).toBeGreaterThan(1024); // base64 is larger than raw
    });
  });
});
