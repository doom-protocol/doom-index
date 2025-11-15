import { describe, expect, it } from "bun:test";
import type { ArchiveMetadata } from "@/types/archive";
import {
  isArchiveMetadata,
  parseDatePrefix,
  buildArchiveKey,
  isValidArchiveFilename,
  extractIdFromFilename,
} from "@/lib/pure/archive";

describe("Archive Metadata Type Guards", () => {
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
});

describe("Date Prefix Parsing", () => {
  it("should parse date string to prefix structure", () => {
    expect(parseDatePrefix("2025-11-14")).toEqual({
      year: "2025",
      month: "11",
      day: "14",
      prefix: "images/2025/11/14/",
    });
  });

  it("should parse ISO timestamp to prefix structure", () => {
    expect(parseDatePrefix("2025-11-14T12:34:00Z")).toEqual({
      year: "2025",
      month: "11",
      day: "14",
      prefix: "images/2025/11/14/",
    });
  });

  it("should throw error for invalid date format", () => {
    expect(() => parseDatePrefix("invalid-date")).toThrow();
  });
});

describe("Archive Key Building", () => {
  it("should build archive key with date prefix", () => {
    const key = buildArchiveKey("2025-11-14", "DOOM_202511141234_abc12345_def45678.webp");
    expect(key).toBe("images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp");
  });

  it("should build metadata key from image key", () => {
    const imageKey = "images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp";
    const metadataKey = imageKey.replace(/\.webp$/, ".json");
    expect(metadataKey).toBe("images/2025/11/14/DOOM_202511141234_abc12345_def45678.json");
  });
});

describe("Filename Validation", () => {
  it("should validate correct filename pattern", () => {
    expect(isValidArchiveFilename("DOOM_202511141234_abc12345_def456789012.webp")).toBe(true);
  });

  it("should reject invalid filename patterns", () => {
    expect(isValidArchiveFilename("invalid.webp")).toBe(false);
    expect(isValidArchiveFilename("DOOM_20251114123_abc12345_def456789012.webp")).toBe(false); // wrong timestamp length
    expect(isValidArchiveFilename("DOOM_202511141234_ABC12345_def456789012.webp")).toBe(false); // uppercase hash
    expect(isValidArchiveFilename("DOOM_202511141234_abc12345_def45678.webp")).toBe(false); // wrong seed length (8 instead of 12)
    expect(isValidArchiveFilename("DOOM_202511141234_abc12345_def456789012.png")).toBe(false); // wrong extension
  });

  it("should extract ID from filename", () => {
    expect(extractIdFromFilename("DOOM_202511141234_abc12345_def456789012.webp")).toBe(
      "DOOM_202511141234_abc12345_def456789012",
    );
  });
});
