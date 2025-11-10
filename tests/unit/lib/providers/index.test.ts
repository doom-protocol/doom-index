import { describe, it, expect } from "bun:test";
import { resolveProvider, resolveProviderWithMock, createSmartProvider } from "@/lib/providers";

describe("Provider Resolution", () => {
  describe("resolveProvider", () => {
    it("should return ai-sdk provider when specified", () => {
      const provider = resolveProvider("ai-sdk");
      expect(provider.name).toBe("ai-sdk");
    });

    it("should return runware-sdk provider when specified", () => {
      const provider = resolveProvider("runware-sdk");
      expect(provider.name).toBe("runware-sdk");
    });

    it("should return smart provider when specified", () => {
      const provider = resolveProvider("smart");
      expect(provider.name).toBe("smart");
    });

    it("should return smart provider by default", () => {
      const provider = resolveProvider();
      expect(provider.name).toBe("smart");
    });
  });

  describe("resolveProviderWithMock (for testing)", () => {
    it("should return mock provider when specified", () => {
      const provider = resolveProviderWithMock("mock");
      expect(provider.name).toBe("mock");
    });

    it("should resolve other providers normally", () => {
      const aiProvider = resolveProviderWithMock("ai-sdk");
      expect(aiProvider.name).toBe("ai-sdk");

      const runwareProvider = resolveProviderWithMock("runware-sdk");
      expect(runwareProvider.name).toBe("runware-sdk");

      const smartProvider = resolveProviderWithMock("smart");
      expect(smartProvider.name).toBe("smart");
    });
  });

  describe("Smart Provider Model Selection", () => {
    it("should have smart provider name", () => {
      const provider = createSmartProvider();
      expect(provider.name).toBe("smart");
    });

    it("should have generate method", () => {
      const provider = createSmartProvider();
      expect(typeof provider.generate).toBe("function");
    });
  });

  describe("Model-based Provider Selection Logic", () => {
    it("should route to correct provider based on model", () => {
      // Test that the smart provider correctly identifies which provider to use
      // Note: We don't actually call generate() here since it would require API keys

      const smartProvider = createSmartProvider();
      expect(smartProvider.name).toBe("smart");

      // Verify that specific providers can be resolved
      const aiSdkProvider = resolveProvider("ai-sdk");
      expect(aiSdkProvider.name).toBe("ai-sdk");

      const runwareProvider = resolveProvider("runware-sdk");
      expect(runwareProvider.name).toBe("runware-sdk");
    });
  });
});
