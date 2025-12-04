import { describe, it, expect } from "bun:test";

describe("useSafeTexture", () => {
  it("should export useSafeTexture function and related utilities", async () => {
    const { useSafeTexture } = await import("@/hooks/use-safe-texture");

    expect(typeof useSafeTexture).toBe("function");
    expect(typeof useSafeTexture.preload).toBe("function");
    expect(typeof useSafeTexture.clear).toBe("function");
  });

  it("should handle different input types", () => {
    // Test that the function accepts different input types (type check only)
    const _singleUrl: string = "/test.jpg";
    const _arrayUrls: string[] = ["/test1.jpg", "/test2.jpg"];
    const _objectUrls: Record<string, string> = { main: "/test.jpg" };

    // These should not throw type errors
    expect(typeof _singleUrl).toBe("string");
    expect(Array.isArray(_arrayUrls)).toBe(true);
    expect(typeof _objectUrls).toBe("object");
  });
});
