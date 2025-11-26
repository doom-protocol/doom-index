import { createImageProvider, resolveProviderWithMock } from "@/lib/image-generation-providers";
import { describe, expect, it } from "bun:test";

describe("Provider Resolution", () => {
  describe("createImageProvider", () => {
    it("should return runware provider", () => {
      const provider = createImageProvider();
      expect(provider.name).toBe("runware");
    });

    it("should have generate method", () => {
      const provider = createImageProvider();
      expect(typeof provider.generate).toBe("function");
    });
  });

  describe("resolveProviderWithMock (for testing)", () => {
    it("should return mock provider when specified", () => {
      const provider = resolveProviderWithMock("mock");
      expect(provider.name).toBe("mock");
    });

    it("should fallback to runware provider for non-mock names", () => {
      // @ts-expect-error - Testing fallback behavior with invalid input
      const provider = resolveProviderWithMock("invalid");
      expect(provider.name).toBe("runware");
    });
  });
});
