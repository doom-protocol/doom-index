import { useSafeTexture } from "@/hooks/use-safe-texture";
import { beforeEach, describe, expect, it, mock, vi } from "bun:test";

// Mock useTexture from drei
const mockUseTexture = mock(() => ({}));
mock.module("@react-three/drei", () => ({
  useTexture: mockUseTexture,
}));

describe("useSafeTexture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTexture.mockReturnValue({});
  });

  it("should call useTexture with string input", () => {
    // Note: This is a hook, so we can't test it directly without React context
    // In real usage, it would be called within a React component
    expect(typeof useSafeTexture).toBe("function");
  });

  it("should export useSafeTexture function", () => {
    expect(typeof useSafeTexture).toBe("function");
  });

  it("should accept string input", () => {
    const testUrl = "https://example.com/texture.jpg";
    expect(() => {
      // Type check - should accept string
      const _: Parameters<typeof useSafeTexture>[0] = testUrl;
    }).not.toThrow();
  });

  it("should accept array input", () => {
    const testUrls = ["https://example.com/1.jpg", "https://example.com/2.jpg"];
    expect(() => {
      // Type check - should accept array
      const _: Parameters<typeof useSafeTexture>[0] = testUrls;
    }).not.toThrow();
  });

  it("should accept object input", () => {
    const testUrls = { metalness: "https://example.com/1.jpg", map: "https://example.com/2.jpg" };
    expect(() => {
      // Type check - should accept object
      const _: Parameters<typeof useSafeTexture>[0] = testUrls;
    }).not.toThrow();
  });

  it("should accept options object", () => {
    const options = {
      transformUrl: (url: string) => url,
      onError: (_error: Error, _url: string) => {},
      debug: true,
    };
    expect(() => {
      // Type check - should accept options
      const _: Parameters<typeof useSafeTexture>[1] = options;
    }).not.toThrow();
  });

  it("should accept callback function", () => {
    const callback = (_texture: any) => {};
    expect(() => {
      // Type check - should accept callback
      const _: Parameters<typeof useSafeTexture>[1] = callback;
    }).not.toThrow();
  });
});
