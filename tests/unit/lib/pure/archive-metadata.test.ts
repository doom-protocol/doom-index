import { describe, expect, it } from "bun:test";
import type { ArchiveMetadata } from "@/types/archive";
import { isArchiveMetadata } from "@/lib/pure/archive-metadata";

describe("isArchiveMetadata", () => {
  it("should validate valid archive metadata", () => {
    const validMetadata: ArchiveMetadata = {
      id: "DOOM_202511141234_abc12345_def45678",
      timestamp: "2025-11-14T12:34:00Z",
      minuteBucket: "2025-11-14T12:34:00Z",
      paramsHash: "abc12345",
      seed: "def45678",
      mcRounded: {
        CO2: 1000000,
        ICE: 2000000,
        FOREST: 3000000,
        NUKE: 4000000,
        MACHINE: 5000000,
        PANDEMIC: 6000000,
        FEAR: 7000000,
        HOPE: 8000000,
      },
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

    expect(isArchiveMetadata(validMetadata)).toBe(true);
  });

  it("should reject metadata with missing required fields", () => {
    const invalidMetadata = {
      id: "DOOM_202511141234_abc12345_def45678",
      timestamp: "2025-11-14T12:34:00Z",
      // missing minuteBucket
    };

    expect(isArchiveMetadata(invalidMetadata)).toBe(false);
  });

  it("should reject metadata with invalid mcRounded structure", () => {
    const invalidMetadata = {
      id: "DOOM_202511141234_abc12345_def45678",
      timestamp: "2025-11-14T12:34:00Z",
      minuteBucket: "2025-11-14T12:34:00Z",
      paramsHash: "abc12345",
      seed: "def45678",
      mcRounded: {
        CO2: 1000000,
        // missing other tokens
      },
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

    expect(isArchiveMetadata(invalidMetadata)).toBe(false);
  });

  it("should reject metadata with invalid visualParams structure", () => {
    const invalidMetadata = {
      id: "DOOM_202511141234_abc12345_def45678",
      timestamp: "2025-11-14T12:34:00Z",
      minuteBucket: "2025-11-14T12:34:00Z",
      paramsHash: "abc12345",
      seed: "def45678",
      mcRounded: {
        CO2: 1000000,
        ICE: 2000000,
        FOREST: 3000000,
        NUKE: 4000000,
        MACHINE: 5000000,
        PANDEMIC: 6000000,
        FEAR: 7000000,
        HOPE: 8000000,
      },
      visualParams: {
        fogDensity: 0.5,
        // missing other visual params
      },
      imageUrl: "/api/r2/images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp",
      fileSize: 123456,
      prompt: "test prompt",
      negative: "test negative",
    };

    expect(isArchiveMetadata(invalidMetadata)).toBe(false);
  });

  it("should reject non-object values", () => {
    expect(isArchiveMetadata(null)).toBe(false);
    expect(isArchiveMetadata(undefined)).toBe(false);
    expect(isArchiveMetadata("string")).toBe(false);
    expect(isArchiveMetadata(123)).toBe(false);
  });
});
