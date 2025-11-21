import { describe, expect, it } from "bun:test";
import { buildArchiveKey, isValidArchiveFilename, extractIdFromFilename, buildPublicR2Path } from "@/utils/archive";

describe("buildPublicR2Path", () => {
  it("should build public R2 path from key", () => {
    expect(buildPublicR2Path("images/2025/11/14/test.webp")).toBe("/api/r2/images/2025/11/14/test.webp");
  });

  it("should normalize leading slashes", () => {
    expect(buildPublicR2Path("/images/2025/11/14/test.webp")).toBe("/api/r2/images/2025/11/14/test.webp");
    expect(buildPublicR2Path("///images/2025/11/14/test.webp")).toBe("/api/r2/images/2025/11/14/test.webp");
  });
});

describe("buildArchiveKey", () => {
  it("should build archive key with date prefix", () => {
    const key = buildArchiveKey("2025-11-14", "DOOM_202511141234_abc12345_def45678.webp");
    expect(key).toBe("images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp");
  });

  it("should handle ISO timestamp", () => {
    const key = buildArchiveKey("2025-11-14T12:34:00Z", "DOOM_202511141234_abc12345_def45678.webp");
    expect(key).toBe("images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp");
  });

  it("should throw error for invalid date format", () => {
    expect(() => buildArchiveKey("invalid-date", "test.webp")).toThrow();
  });

  it("should build metadata key from image key", () => {
    const imageKey = "images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp";
    const metadataKey = imageKey.replace(/\.webp$/, ".json");
    expect(metadataKey).toBe("images/2025/11/14/DOOM_202511141234_abc12345_def45678.json");
  });
});

describe("isValidArchiveFilename", () => {
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
});

describe("extractIdFromFilename", () => {
  it("should extract ID from filename", () => {
    expect(extractIdFromFilename("DOOM_202511141234_abc12345_def456789012.webp")).toBe(
      "DOOM_202511141234_abc12345_def456789012",
    );
  });

  it("should handle filename without extension", () => {
    expect(extractIdFromFilename("DOOM_202511141234_abc12345_def456789012")).toBe(
      "DOOM_202511141234_abc12345_def456789012",
    );
  });
});
