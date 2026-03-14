/**
 * Unit tests for NFT Metadata Builder
 * Tests Metaplex standard compliance
 */

import { buildFullNftMetadata, buildNftMetadata } from "@/lib/metadata-builder";
import { describe, expect, it } from "bun:test";

describe("unit/lib/metadata-builder", () => {
  describe("buildNftMetadata", () => {
    it("should build Metaplex-compliant metadata", () => {
      const metadata = buildNftMetadata({
        cidGlb: "QmTest123",
        paintingHash: "abc123",
        timestamp: "2025-01-01T00:00:00Z",
        walletAddress: "0x123",
      });

      expect(metadata.name).toBe("DOOM NFT #abc123");
      expect(metadata.symbol).toBe("DOOM");
      expect(metadata.description).toContain("DOOM INDEX");
      expect(metadata.image).toBe("ipfs://QmTest123");
      expect(metadata.external_url).toContain("doomindex.fun");
      expect(metadata.attributes).toBeArray();
      expect(metadata.properties.category).toBe("glb");
      expect(metadata.properties.files).toBeArray();
      expect(metadata.properties.files[0]?.uri).toBe("ipfs://QmTest123");
      expect(metadata.properties.files[0]?.type).toBe("model/gltf-binary");
    });

    it("should include painting hash in attributes", () => {
      const metadata = buildNftMetadata({
        cidGlb: "QmTest123",
        paintingHash: "abc123",
        timestamp: "2025-01-01T00:00:00Z",
      });

      const hashAttr = metadata.attributes.find((attr) => attr.trait_type === "Painting Hash");
      expect(hashAttr).toBeDefined();
      expect(hashAttr?.value).toBe("abc123");
    });

    it("should include timestamp in attributes", () => {
      const metadata = buildNftMetadata({
        cidGlb: "QmTest123",
        paintingHash: "abc123",
        timestamp: "2025-01-01T00:00:00Z",
      });

      const timestampAttr = metadata.attributes.find((attr) => attr.trait_type === "Created At");
      expect(timestampAttr).toBeDefined();
      expect(timestampAttr?.value).toBe("2025-01-01T00:00:00Z");
    });

    it("should include wallet address in attributes when provided", () => {
      const metadata = buildNftMetadata({
        cidGlb: "QmTest123",
        paintingHash: "abc123",
        timestamp: "2025-01-01T00:00:00Z",
        walletAddress: "0x123",
      });

      const walletAttr = metadata.attributes.find((attr) => attr.trait_type === "Minted By");
      expect(walletAttr).toBeDefined();
      expect(walletAttr?.value).toBe("0x123");
    });

    it("should not include wallet address when not provided", () => {
      const metadata = buildNftMetadata({
        cidGlb: "QmTest123",
        paintingHash: "abc123",
        timestamp: "2025-01-01T00:00:00Z",
      });

      const walletAttr = metadata.attributes.find((attr) => attr.trait_type === "Minted By");
      expect(walletAttr).toBeUndefined();
    });

    it("should comply with Metaplex name length limit", () => {
      const metadata = buildNftMetadata({
        cidGlb: "QmTest123",
        paintingHash: "a".repeat(100), // Very long hash
        timestamp: "2025-01-01T00:00:00Z",
      });

      expect(metadata.name.length).toBeLessThanOrEqual(32);
    });

    it("should comply with Metaplex symbol length limit", () => {
      const metadata = buildNftMetadata({
        cidGlb: "QmTest123",
        paintingHash: "abc123",
        timestamp: "2025-01-01T00:00:00Z",
      });

      expect(metadata.symbol.length).toBeLessThanOrEqual(10);
    });
  });

  describe("buildFullNftMetadata", () => {
    it("builds Arweave-backed NFT metadata with image and animation URLs", () => {
      const metadata = buildFullNftMetadata({
        painting: {
          id: "DOOM_202512020110_03309aff_5779632aeaa9",
          seed: "5779632aeaa9",
          paramsHash: "03309aff",
          fileSize: 1024000,
          visualParams: {
            fogDensity: 0.5,
            skyTint: 0.3,
            reflectivity: 0.2,
            blueBalance: 0.1,
            vegetationDensity: 0.4,
            organicPattern: 0.3,
            radiationGlow: 0.1,
            debrisIntensity: 0.2,
            mechanicalPattern: 0.1,
            metallicRatio: 0.2,
            fractalDensity: 0.3,
            bioluminescence: 0.1,
            shadowDepth: 0.4,
            redHighlight: 0.1,
            lightIntensity: 0.8,
            warmHue: 0.2,
            tokenWeights: {
              fear: 0.2,
              hope: 0.3,
              machine: 0.1,
              ice: 0.1,
              forest: 0.1,
              co2: 0.1,
              pandemic: 0.05,
              nuke: 0.05,
            },
            worldPrompt: "Doom world prompt",
          },
          prompt: "Positive prompt",
          negative: "Negative prompt",
        },
        arweaveImageUrl: "https://arweave.net/image-tx",
        arweaveAnimationUrl: "https://arweave.net/animation-tx",
        tokenNumber: 7,
      });

      expect(metadata.name).toBe("DOOM NFT #7");
      expect(metadata.image).toBe("https://arweave.net/image-tx");
      expect(metadata.animation_url).toBe("https://arweave.net/animation-tx");
      expect(metadata.external_url).toBe("https://doomindex.fun/artworks/7");
      expect(metadata.category).toBe("vr");
      expect(metadata.properties.files).toEqual([
        { uri: "https://arweave.net/image-tx", type: "image/png" },
        { uri: "https://arweave.net/animation-tx", type: "model/gltf-binary" },
      ]);
    });

    it("uses the provided image content type when present", () => {
      const metadata = buildFullNftMetadata({
        painting: {
          id: "painting-id",
          seed: "seed-1",
          paramsHash: "params-hash",
          fileSize: 42,
          visualParams: {
            fogDensity: 0.5,
            skyTint: 0.3,
            reflectivity: 0.2,
            blueBalance: 0.1,
            vegetationDensity: 0.4,
            organicPattern: 0.3,
            radiationGlow: 0.1,
            debrisIntensity: 0.2,
            mechanicalPattern: 0.1,
            metallicRatio: 0.2,
            fractalDensity: 0.3,
            bioluminescence: 0.1,
            shadowDepth: 0.4,
            redHighlight: 0.1,
            lightIntensity: 0.8,
            warmHue: 0.2,
            tokenWeights: {
              fear: 0.2,
              hope: 0.3,
              machine: 0.1,
              ice: 0.1,
              forest: 0.1,
              co2: 0.1,
              pandemic: 0.05,
              nuke: 0.05,
            },
            worldPrompt: "Doom world prompt",
          },
          prompt: "Positive prompt",
          negative: "Negative prompt",
        },
        arweaveImageUrl: "https://arweave.net/image-tx",
        arweaveAnimationUrl: "https://arweave.net/animation-tx",
        arweaveImageContentType: "image/webp",
        tokenNumber: 8,
      });

      expect(metadata.properties.files[0]).toEqual({
        uri: "https://arweave.net/image-tx",
        type: "image/webp",
      });
    });

    it("includes rich DOOM INDEX attributes and nested source metadata", () => {
      const metadata = buildFullNftMetadata({
        painting: {
          id: "painting-id",
          seed: "seed-1",
          paramsHash: "params-hash",
          fileSize: 42,
          visualParams: {
            fogDensity: 0.5,
            skyTint: 0.3,
            reflectivity: 0.2,
            blueBalance: 0.1,
            vegetationDensity: 0.4,
            organicPattern: 0.3,
            radiationGlow: 0.1,
            debrisIntensity: 0.2,
            mechanicalPattern: 0.1,
            metallicRatio: 0.2,
            fractalDensity: 0.3,
            bioluminescence: 0.1,
            shadowDepth: 0.4,
            redHighlight: 0.1,
            lightIntensity: 0.8,
            warmHue: 0.2,
            tokenWeights: {
              fear: 0.2,
              hope: 0.3,
              machine: 0.1,
              ice: 0.1,
              forest: 0.1,
              co2: 0.1,
              pandemic: 0.05,
              nuke: 0.05,
            },
            worldPrompt: "Doom world prompt",
          },
          prompt: "Positive prompt",
          negative: "Negative prompt",
        },
        arweaveImageUrl: "https://arweave.net/image-tx",
        arweaveAnimationUrl: "https://arweave.net/animation-tx",
        tokenNumber: 99,
      });

      expect(metadata.attributes).toContainEqual({ trait_type: "Generated", value: "painting-id" });
      expect(metadata.attributes).toContainEqual({ trait_type: "ID", value: 99 });
      expect(metadata.attributes).toContainEqual({
        trait_type: "Prompt",
        value: "Positive prompt",
      });
      expect(metadata.attributes).toContainEqual({
        trait_type: "Negative Prompt",
        value: "Negative prompt",
      });
      expect(metadata.doom_index.source_id).toBe("painting-id");
      expect(metadata.doom_index.seed).toBe("seed-1");
      expect(metadata.doom_index.params_hash).toBe("params-hash");
      expect(metadata.doom_index.prompt).toBe("Positive prompt");
      expect(metadata.doom_index.negative_prompt).toBe("Negative prompt");
      expect(metadata.doom_index.visual_parameters.worldPrompt).toBe("Doom world prompt");
    });
  });
});
