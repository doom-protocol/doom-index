import { beforeEach, describe, expect, it, mock } from "bun:test";

// Mock env module before importing dependent modules
let mockR2Url: string | undefined = undefined;

mock.module("@/env", () => ({
  env: {
    get NEXT_PUBLIC_R2_URL() {
      return mockR2Url;
    },
  },
}));

// Import after mocking
import { buildPaintingKey, buildPublicR2Path, extractIdFromFilename, isValidPaintingFilename } from "@/utils/paintings";

describe("buildPublicR2Path", () => {
  beforeEach(() => {
    mockR2Url = undefined;
  });

  it("should build public R2 path from key", () => {
    expect(buildPublicR2Path("images/2025/11/14/test.webp")).toBe("/api/r2/images/2025/11/14/test.webp");
  });

  it("should normalize leading slashes", () => {
    expect(buildPublicR2Path("/images/2025/11/14/test.webp")).toBe("/api/r2/images/2025/11/14/test.webp");
    expect(buildPublicR2Path("///images/2025/11/14/test.webp")).toBe("/api/r2/images/2025/11/14/test.webp");
  });

  it("should use NEXT_PUBLIC_R2_URL when set", () => {
    mockR2Url = "assets.example.com";
    expect(buildPublicR2Path("images/2025/11/14/test.webp")).toBe(
      "https://assets.example.com/images/2025/11/14/test.webp",
    );
  });

  it("should handle localhost domain with http", () => {
    mockR2Url = "localhost:8080";
    expect(buildPublicR2Path("images/test.webp")).toBe("http://localhost:8080/images/test.webp");
  });

  it("should normalize trailing slashes in URL", () => {
    mockR2Url = "assets.example.com/";
    expect(buildPublicR2Path("images/test.webp")).toBe("https://assets.example.com/images/test.webp");
  });

  it("should handle URL with https:// protocol", () => {
    mockR2Url = "https://storage.doomindex.fun";
    expect(buildPublicR2Path("images/2025/11/14/test.webp")).toBe(
      "https://storage.doomindex.fun/images/2025/11/14/test.webp",
    );
  });

  it("should handle URL with https:// protocol and trailing slash", () => {
    mockR2Url = "https://storage.doomindex.fun/";
    expect(buildPublicR2Path("images/test.webp")).toBe("https://storage.doomindex.fun/images/test.webp");
  });

  it("should handle URL with http:// protocol (localhost)", () => {
    mockR2Url = "http://localhost:8080";
    expect(buildPublicR2Path("images/test.webp")).toBe("http://localhost:8080/images/test.webp");
  });

  it("should handle full URL with path", () => {
    mockR2Url = "http://localhost:8787/api/r2";
    expect(buildPublicR2Path("images/test.webp")).toBe("http://localhost:8787/api/r2/images/test.webp");
  });
});

describe("buildPaintingKey", () => {
  it("should build archive key with date prefix", () => {
    const key = buildPaintingKey("2025-11-14", "DOOM_202511141234_abc12345_def45678.webp");
    expect(key).toBe("images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp");
  });

  it("should handle ISO timestamp", () => {
    const key = buildPaintingKey("2025-11-14T12:34:00Z", "DOOM_202511141234_abc12345_def45678.webp");
    expect(key).toBe("images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp");
  });

  it("should throw error for invalid date format", () => {
    expect(() => buildPaintingKey("invalid-date", "test.webp")).toThrow();
  });

  it("should build metadata key from image key", () => {
    const imageKey = "images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp";
    const metadataKey = imageKey.replace(/\.webp$/, ".json");
    expect(metadataKey).toBe("images/2025/11/14/DOOM_202511141234_abc12345_def45678.json");
  });
});

describe("isValidPaintingFilename", () => {
  it("should validate correct filename pattern", () => {
    expect(isValidPaintingFilename("DOOM_202511141234_abc12345_def456789012.webp")).toBe(true);
  });

  it("should reject invalid filename patterns", () => {
    expect(isValidPaintingFilename("invalid.webp")).toBe(false);
    expect(isValidPaintingFilename("DOOM_20251114123_abc12345_def456789012.webp")).toBe(false); // wrong timestamp length
    expect(isValidPaintingFilename("DOOM_202511141234_ABC12345_def456789012.webp")).toBe(false); // uppercase hash
    expect(isValidPaintingFilename("DOOM_202511141234_abc12345_def45678.webp")).toBe(false); // wrong seed length (8 instead of 12)
    expect(isValidPaintingFilename("DOOM_202511141234_abc12345_def456789012.png")).toBe(false); // wrong extension
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
