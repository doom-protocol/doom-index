/**
 * Unit tests for Pinata Client
 * Tests the Anti-Corruption Layer for Pinata SDK
 */

import { describe, expect, it, mock } from "bun:test";
import { createPinataClient } from "@/lib/pinata-client";

describe("unit/lib/pinata-client", () => {
  describe("createSignedUploadUrl", () => {
    it("should generate signed URL with valid options", async () => {
      const mockPinata = {
        upload: {
          public: {
            createSignedURL: mock(async () => "https://uploads.pinata.cloud/v3/files/signed-url-123"),
          },
        },
      };

      const client = createPinataClient({
        apiKey: "test-jwt",
        // @ts-expect-error - Mock Pinata SDK
        pinataClient: mockPinata,
      });

      const result = await client.createSignedUploadUrl({
        expires: 30,
        name: "test-file.glb",
        keyvalues: {
          walletAddress: "0x123",
          timestamp: "2025-01-01T00:00:00Z",
          paintingHash: "abc123",
          network: "devnet",
        },
        group: "nft-mints",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.url).toBe("https://uploads.pinata.cloud/v3/files/signed-url-123");
        expect(result.value.expires).toBeGreaterThan(Date.now() / 1000);
      }

      expect(mockPinata.upload.public.createSignedURL).toHaveBeenCalledWith({
        expires: 30,
        name: "test-file.glb",
        keyvalues: {
          walletAddress: "0x123",
          timestamp: "2025-01-01T00:00:00Z",
          paintingHash: "abc123",
          network: "devnet",
        },
        groupId: "nft-mints",
      });
    });

    it("should return error when Pinata API fails", async () => {
      const mockPinata = {
        upload: {
          public: {
            createSignedURL: mock(async () => {
              throw new Error("Pinata API error");
            }),
          },
        },
      };

      const client = createPinataClient({
        apiKey: "test-jwt",
        // @ts-expect-error - Mock Pinata SDK
        pinataClient: mockPinata,
      });

      const result = await client.createSignedUploadUrl({
        expires: 30,
        name: "test-file.glb",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ExternalApiError");
        expect(result.error.message).toContain("Pinata API error");
      }
    });

    it("should return error when JWT is missing", async () => {
      const result = await createPinataClient({ apiKey: undefined }).createSignedUploadUrl({
        expires: 30,
        name: "test-file.glb",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ConfigurationError");
        expect(result.error.message).toContain("PINATA_JWT");
      }
    });
  });

  describe("convertToGatewayUrl", () => {
    it("should convert CID to signed gateway URL", async () => {
      const mockPinata = {
        gateways: {
          public: {
            convert: mock(async () => "https://gateway.pinata.cloud/ipfs/QmTest123?signature=xyz"),
          },
        },
      };

      const client = createPinataClient({
        apiKey: "test-jwt",
        // @ts-expect-error - Mock Pinata SDK
        pinataClient: mockPinata,
      });

      const result = await client.convertToGatewayUrl("QmTest123");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("https://gateway.pinata.cloud/ipfs/QmTest123?signature=xyz");
      }

      expect(mockPinata.gateways.public.convert).toHaveBeenCalledWith("ipfs://QmTest123");
    });

    it("should return error when CID is invalid", async () => {
      const mockPinata = {
        gateways: {
          public: {
            convert: mock(async () => {
              throw new Error("Invalid CID");
            }),
          },
        },
      };

      const client = createPinataClient({
        apiKey: "test-jwt",
        // @ts-expect-error - Mock Pinata SDK
        pinataClient: mockPinata,
      });

      const result = await client.convertToGatewayUrl("invalid-cid");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ExternalApiError");
        expect(result.error.message).toContain("Invalid CID");
      }
    });
  });
});
