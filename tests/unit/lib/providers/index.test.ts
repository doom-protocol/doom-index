import { describe, it, expect } from "bun:test";
import { resolveProviderForModel, resolveProviderWithMock, createAutoResolveProvider } from "@/lib/providers";

describe("Provider Resolution", () => {
  describe("resolveProviderForModel", () => {
    it("should return ai-sdk provider for dall-e-3 model", () => {
      const provider = resolveProviderForModel("dall-e-3");
      expect(provider.name).toBe("ai-sdk");
    });

    it("should return ai-sdk provider for gpt-image-1 model", () => {
      const provider = resolveProviderForModel("gpt-image-1");
      expect(provider.name).toBe("ai-sdk");
    });

    it("should return runware provider for runware model", () => {
      const provider = resolveProviderForModel("runware:100@1");
      expect(provider.name).toBe("runware");
    });

    it("should return runware provider for civitai model", () => {
      const provider = resolveProviderForModel("civitai:38784@44716");
      expect(provider.name).toBe("runware");
    });

    it("should return runware provider by default when no model specified", () => {
      const provider = resolveProviderForModel();
      expect(provider.name).toBe("runware");
    });

    it("should return runware provider for unknown model", () => {
      const provider = resolveProviderForModel("unknown-model");
      expect(provider.name).toBe("runware");
    });
  });

  describe("resolveProviderWithMock (for testing)", () => {
    it("should return mock provider when specified", () => {
      const provider = resolveProviderWithMock("mock");
      expect(provider.name).toBe("mock");
    });
  });

  describe("Auto Resolve Provider", () => {
    it("should have auto-resolve provider name", () => {
      const provider = createAutoResolveProvider();
      expect(provider.name).toBe("auto-resolve");
    });

    it("should have generate method", () => {
      const provider = createAutoResolveProvider();
      expect(typeof provider.generate).toBe("function");
    });
  });

  describe("Model-based Provider Selection Logic", () => {
    it("should route to correct provider based on model", () => {
      // Test that providers are correctly resolved based on model names
      // Note: We don't actually call generate() here since it would require API keys

      const aiSdkProvider = resolveProviderForModel("dall-e-3");
      expect(aiSdkProvider.name).toBe("ai-sdk");

      const runwareProvider = resolveProviderForModel("runware:100@1");
      expect(runwareProvider.name).toBe("runware");

      const civitaiProvider = resolveProviderForModel("civitai:38784@44716");
      expect(civitaiProvider.name).toBe("runware");
    });
  });
});
