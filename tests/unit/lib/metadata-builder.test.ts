/**
 * Unit tests for NFT Metadata Builder
 * Tests Metaplex standard compliance
 */

import { buildNftMetadata } from "@/lib/metadata-builder";
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

      expect(metadata.name).toBe("DOOM INDEX #abc123");
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

      const hashAttr = metadata.attributes.find(attr => attr.trait_type === "Painting Hash");
      expect(hashAttr).toBeDefined();
      expect(hashAttr?.value).toBe("abc123");
    });

    it("should include timestamp in attributes", () => {
      const metadata = buildNftMetadata({
        cidGlb: "QmTest123",
        paintingHash: "abc123",
        timestamp: "2025-01-01T00:00:00Z",
      });

      const timestampAttr = metadata.attributes.find(attr => attr.trait_type === "Created At");
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

      const walletAttr = metadata.attributes.find(attr => attr.trait_type === "Minted By");
      expect(walletAttr).toBeDefined();
      expect(walletAttr?.value).toBe("0x123");
    });

    it("should not include wallet address when not provided", () => {
      const metadata = buildNftMetadata({
        cidGlb: "QmTest123",
        paintingHash: "abc123",
        timestamp: "2025-01-01T00:00:00Z",
      });

      const walletAttr = metadata.attributes.find(attr => attr.trait_type === "Minted By");
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
});
