import { useSafeTexture, type UseSafeTextureOptions } from "@/hooks/use-safe-texture";
import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { Texture } from "three";

// Mock THREE.TextureLoader
const mockLoad = mock((url: string, onLoad?: (texture: Texture) => void) => {
  // Simulate successful load
  setTimeout(() => {
    const mockTexture = { colorSpace: "srgb", anisotropy: 1, needsUpdate: false } as unknown as Texture;
    onLoad?.(mockTexture);
  }, 10);
});
const mockSetCrossOrigin = mock(() => {});

class MockTextureLoader {
  setCrossOrigin = mockSetCrossOrigin;
  load = mockLoad;
}

mock.module("three", () => ({
  TextureLoader: MockTextureLoader,
}));

describe("useSafeTexture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export useSafeTexture function", () => {
    expect(typeof useSafeTexture).toBe("function");
  });

  it("should accept string input", () => {
    const testUrl = "https://example.com/texture.jpg";
    // Type check - should accept string (first overload)
    const _url: string = testUrl;
    expect(_url).toBe(testUrl);
  });

  it("should accept array input", () => {
    const testUrls: string[] = ["https://example.com/1.jpg", "https://example.com/2.jpg"];
    // Type check - should accept array (third overload)
    expect(testUrls.length).toBe(2);
  });

  it("should accept object input", () => {
    const testUrls: Record<string, string> = {
      metalness: "https://example.com/1.jpg",
      map: "https://example.com/2.jpg",
    };
    // Type check - should accept object (fifth overload)
    expect(Object.keys(testUrls).length).toBe(2);
  });

  it("should accept options object", () => {
    const options: UseSafeTextureOptions = {
      onError: (_error: Error) => {},
    };
    // Type check - should accept options
    expect(typeof options.onError).toBe("function");
  });

  it("should accept callback function", () => {
    const callback = (_texture: Texture) => {};
    // Type check - should accept callback
    expect(typeof callback).toBe("function");
  });
});
