import { describe, expect, it } from "bun:test";
import type { PaintingMetadata } from "@/types/paintings";
import { isPaintingMetadata } from "@/lib/pure/painting-metadata";

describe("isPaintingMetadata", () => {
  it("should validate valid archive metadata", () => {
    const validMetadata: PaintingMetadata = {
      id: "DOOM_202511141234_abc12345_def45678",
      timestamp: "2025-11-14T12:34:00Z",
      minuteBucket: "2025-11-14T12:34:00Z",
      paramsHash: "abc12345",
      seed: "def45678",
      visualParams: {
        fogDensity: 0.5,
        skyTint: 0.6,
        reflectivity: 0.7,
        blueBalance: 0.8,
        vegetationDensity: 0.9,
        organicPattern: 0.1,
        radiationGlow: 0.2,
        debrisIntensity: 0.3,
        mechanicalPattern: 0.4,
        metallicRatio: 0.5,
        fractalDensity: 0.6,
        bioluminescence: 0.7,
        shadowDepth: 0.8,
        redHighlight: 0.9,
        lightIntensity: 0.1,
        warmHue: 0.2,
      },
      imageUrl: "/api/r2/images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp",
      fileSize: 123456,
      prompt: "test prompt",
      negative: "test negative",
    };

    expect(isPaintingMetadata(validMetadata)).toBe(true);
  });

  it("should reject metadata with missing required fields", () => {
    const invalidMetadata = {
      id: "DOOM_202511141234_abc12345_def45678",
      timestamp: "2025-11-14T12:34:00Z",
      // missing minuteBucket
    };

    expect(isPaintingMetadata(invalidMetadata)).toBe(false);
  });

  it("should reject metadata with invalid visualParams structure", () => {
    const invalidMetadata = {
      id: "DOOM_202511141234_abc12345_def45678",
      timestamp: "2025-11-14T12:34:00Z",
      minuteBucket: "2025-11-14T12:34:00Z",
      paramsHash: "abc12345",
      seed: "def45678",
      visualParams: {
        fogDensity: 0.5,
        // missing other visual params
      },
      imageUrl: "/api/r2/images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp",
      fileSize: 123456,
      prompt: "test prompt",
      negative: "test negative",
    };

    expect(isPaintingMetadata(invalidMetadata)).toBe(false);
  });

  it("should reject non-object values", () => {
    expect(isPaintingMetadata(null)).toBe(false);
    expect(isPaintingMetadata(undefined)).toBe(false);
    expect(isPaintingMetadata("string")).toBe(false);
    expect(isPaintingMetadata(123)).toBe(false);
  });
});
