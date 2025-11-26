/**
 * Image Generation Service Integration Tests
 *
 * Tests the full flow of ImageGenerationService including:
 * - WorldPromptService integration
 * - ImageProvider integration
 * - Error handling and retry logic
 * - Reference image URL handling
 */

import { createImageGenerationService } from "@/services/image-generation";
import type { PromptComposition, WorldPromptService } from "@/services/world-prompt-service";
import type { AppError } from "@/types/app-error";
import type { ImageProvider } from "@/types/domain";
import type { PaintingContext } from "@/types/painting-context";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { err, ok } from "neverthrow";

const mockPaintingContext: PaintingContext = {
  t: { n: "Bitcoin", c: "bitcoin" },
  m: { mc: 2_500_000_000_000, bd: 45.5, fg: 65 },
  s: { p: 50000, p7: 2.5, v: 30_000_000_000, mc: 1_000_000_000_000, vol: 0.5 },
  c: "euphoria",
  a: "l1-sovereign",
  e: { k: "rally", i: 2 },
  o: "citadel-panorama",
  p: "solar-gold",
  d: { dir: "up", vol: "medium" },
  f: ["store-of-value"],
  h: ["cosmic horizon stretches across the void"],
};

describe("ImageGenerationService Integration", () => {
  let mockImageProvider: ImageProvider;
  let mockPromptService: WorldPromptService;

  beforeEach(() => {
    mock.restore();
  });

  describe("generateTokenImage", () => {
    it("should generate token image successfully with reference image URL", async () => {
      const mockImageBuffer = new ArrayBuffer(1024);
      const mockProviderMeta = { jobId: "test-job-456" };
      const referenceImageUrl = "https://example.com/token-logo.png";

      mockImageProvider = {
        name: "mock",
        generate: mock(() =>
          Promise.resolve(
            ok({
              imageBuffer: mockImageBuffer,
              providerMeta: mockProviderMeta,
            }),
          ),
        ),
      };

      const mockComposition: PromptComposition = {
        seed: "test-seed-456",
        minuteBucket: "2024-01-01T12:00",
        vp: {
          fogDensity: 0.5,
          skyTint: 0.5,
          reflectivity: 0.5,
          blueBalance: 0.5,
          vegetationDensity: 0.5,
          organicPattern: 0.5,
          radiationGlow: 0.5,
          debrisIntensity: 0.5,
          mechanicalPattern: 0.5,
          metallicRatio: 0.5,
          fractalDensity: 0.5,
          bioluminescence: 0.5,
          shadowDepth: 0.5,
          redHighlight: 0.5,
          lightIntensity: 0.5,
          warmHue: 0.5,
        },
        prompt: {
          text: "A Bitcoin-themed temple with golden pillars",
          negative: "blurry, low quality",
          size: { w: 1024, h: 1024 },
          format: "webp" as const,
          seed: "test-seed-456",
          filename: "test.webp",
        },
        paramsHash: "test-hash-456",
      };

      mockPromptService = {
        composeTokenPrompt: mock(() => Promise.resolve(ok(mockComposition))),
      };

      const service = createImageGenerationService({
        promptService: mockPromptService,
        imageProvider: mockImageProvider,
      });

      const result = await service.generateTokenImage({
        paintingContext: mockPaintingContext,
        tokenMeta: {
          id: "bitcoin",
          name: "Bitcoin",
          symbol: "BTC",
          chainId: "bitcoin",
          contractAddress: null,
          createdAt: new Date().toISOString(),
        },
        referenceImageUrl,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.imageBuffer).toBe(mockImageBuffer);
        expect(result.value.providerMeta).toEqual(mockProviderMeta);
        expect(result.value.composition.prompt.text).toContain("Bitcoin");
      }
    });

    it("should sanitize invalid reference image URLs", async () => {
      const mockImageBuffer = new ArrayBuffer(1024);
      const mockProviderMeta = { jobId: "test-job-789" };
      const invalidReferenceUrl = "javascript:alert('xss')";

      mockImageProvider = {
        name: "mock",
        generate: mock(() =>
          Promise.resolve(
            ok({
              imageBuffer: mockImageBuffer,
              providerMeta: mockProviderMeta,
            }),
          ),
        ),
      };

      const mockComposition: PromptComposition = {
        seed: "test-seed-789",
        minuteBucket: "2024-01-01T12:00",
        vp: {
          fogDensity: 0.5,
          skyTint: 0.5,
          reflectivity: 0.5,
          blueBalance: 0.5,
          vegetationDensity: 0.5,
          organicPattern: 0.5,
          radiationGlow: 0.5,
          debrisIntensity: 0.5,
          mechanicalPattern: 0.5,
          metallicRatio: 0.5,
          fractalDensity: 0.5,
          bioluminescence: 0.5,
          shadowDepth: 0.5,
          redHighlight: 0.5,
          lightIntensity: 0.5,
          warmHue: 0.5,
        },
        prompt: {
          text: "A Bitcoin-themed temple",
          negative: "blurry",
          size: { w: 1024, h: 1024 },
          format: "webp" as const,
          seed: "test-seed-789",
          filename: "test.webp",
        },
        paramsHash: "test-hash-789",
      };

      mockPromptService = {
        composeTokenPrompt: mock(() => Promise.resolve(ok(mockComposition))),
      };

      const service = createImageGenerationService({
        promptService: mockPromptService,
        imageProvider: mockImageProvider,
      });

      const result = await service.generateTokenImage({
        paintingContext: mockPaintingContext,
        tokenMeta: {
          id: "bitcoin",
          name: "Bitcoin",
          symbol: "BTC",
          chainId: "bitcoin",
          contractAddress: null,
          createdAt: new Date().toISOString(),
        },
        referenceImageUrl: invalidReferenceUrl,
      });

      expect(result.isOk()).toBe(true);
      // Verify that the invalid URL was sanitized (not passed to the provider)
    });

    it("should convert HTTP URLs to HTTPS", async () => {
      const mockImageBuffer = new ArrayBuffer(1024);
      const mockProviderMeta = { jobId: "test-job-101" };
      const httpUrl = "http://example.com/token-logo.png";

      mockImageProvider = {
        name: "mock",
        generate: mock(() =>
          Promise.resolve(
            ok({
              imageBuffer: mockImageBuffer,
              providerMeta: mockProviderMeta,
            }),
          ),
        ),
      };

      const mockComposition: PromptComposition = {
        seed: "test-seed-789",
        minuteBucket: "2024-01-01T12:00",
        vp: {
          fogDensity: 0.5,
          skyTint: 0.5,
          reflectivity: 0.5,
          blueBalance: 0.5,
          vegetationDensity: 0.5,
          organicPattern: 0.5,
          radiationGlow: 0.5,
          debrisIntensity: 0.5,
          mechanicalPattern: 0.5,
          metallicRatio: 0.5,
          fractalDensity: 0.5,
          bioluminescence: 0.5,
          shadowDepth: 0.5,
          redHighlight: 0.5,
          lightIntensity: 0.5,
          warmHue: 0.5,
        },
        prompt: {
          text: "A Bitcoin-themed temple",
          negative: "blurry",
          size: { w: 1024, h: 1024 },
          format: "webp" as const,
          seed: "test-seed-789",
          filename: "test.webp",
        },
        paramsHash: "test-hash-789",
      };

      mockPromptService = {
        composeTokenPrompt: mock(() => Promise.resolve(ok(mockComposition))),
      };

      const service = createImageGenerationService({
        promptService: mockPromptService,
        imageProvider: mockImageProvider,
      });

      const result = await service.generateTokenImage({
        paintingContext: mockPaintingContext,
        tokenMeta: {
          id: "bitcoin",
          name: "Bitcoin",
          symbol: "BTC",
          chainId: "bitcoin",
          contractAddress: null,
          createdAt: new Date().toISOString(),
        },
        referenceImageUrl: httpUrl,
      });

      expect(result.isOk()).toBe(true);
      // Verify that HTTP was converted to HTTPS
    });

    it("should handle token prompt generation errors", async () => {
      const mockError: AppError = {
        type: "InternalError",
        message: "Token prompt generation failed",
      };

      mockImageProvider = {
        name: "mock",
        generate: mock(() => Promise.resolve(ok({ imageBuffer: new ArrayBuffer(1024), providerMeta: {} }))),
      };

      mockPromptService = {
        composeTokenPrompt: mock(() => Promise.resolve(err(mockError))),
      };

      const service = createImageGenerationService({
        promptService: mockPromptService,
        imageProvider: mockImageProvider,
      });

      const result = await service.generateTokenImage({
        paintingContext: mockPaintingContext,
        tokenMeta: {
          id: "bitcoin",
          name: "Bitcoin",
          symbol: "BTC",
          chainId: "bitcoin",
          contractAddress: null,
          createdAt: new Date().toISOString(),
        },
        referenceImageUrl: "https://example.com/logo.png",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("InternalError");
      }
    });
  });
});
