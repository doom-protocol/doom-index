/**
 * Unit tests for IPFS tRPC Router
 * Tests the tRPC procedures for Pinata signed URL generation
 */

import { describe, expect, it, mock } from "bun:test";
import { err, ok } from "neverthrow";
import { ipfsRouter } from "@/server/trpc/routers/ipfs";
import { createMockContext } from "../helpers";

describe("unit/server/trpc/routers/ipfs", () => {
  describe("createSignedUploadUrl", () => {
    it("should create signed URL for GLB file", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPinataClient = {
        createSignedUploadUrl: mock(async () =>
          ok({
            url: "https://uploads.pinata.cloud/v3/files/signed-url-123",
            expires: currentTime + 30,
          }),
        ),
        convertToGatewayUrl: mock(async () => ok("https://gateway.pinata.cloud/ipfs/QmTest")),
      };

      const ctx = createMockContext({
        // @ts-expect-error - pinataClient is injected for testing
        pinataClient: mockPinataClient,
      });

      const caller = ipfsRouter.createCaller(ctx);

      const result = await caller.createSignedUploadUrl({
        filename: "painting_abc123.glb",
        contentType: "application/octet-stream",
        keyvalues: {
          walletAddress: "0x123",
          timestamp: "2025-01-01T00:00:00Z",
          paintingHash: "abc123",
          network: "devnet",
        },
      });

      expect(result.url).toBe("https://uploads.pinata.cloud/v3/files/signed-url-123");
      expect(result.expires).toBe(currentTime + 30);

      expect(mockPinataClient.createSignedUploadUrl).toHaveBeenCalledWith({
        expires: 30,
        name: "painting_abc123.glb",
        keyvalues: {
          walletAddress: "0x123",
          timestamp: "2025-01-01T00:00:00Z",
          paintingHash: "abc123",
          network: "devnet",
        },
      });
    });

    it("should create signed URL for metadata JSON", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPinataClient = {
        createSignedUploadUrl: mock(async () =>
          ok({
            url: "https://uploads.pinata.cloud/v3/files/signed-url-456",
            expires: currentTime + 30,
          }),
        ),
        convertToGatewayUrl: mock(async () => ok("https://gateway.pinata.cloud/ipfs/QmTest")),
      };

      const ctx = createMockContext({
        // @ts-expect-error - pinataClient is injected for testing
        pinataClient: mockPinataClient,
      });

      const caller = ipfsRouter.createCaller(ctx);

      const result = await caller.createSignedUploadUrl({
        filename: "metadata_abc123.json",
        contentType: "application/json",
        keyvalues: {
          timestamp: "2025-01-01T00:00:00Z",
          paintingHash: "abc123",
          network: "mainnet-beta",
        },
      });

      expect(result.url).toBe("https://uploads.pinata.cloud/v3/files/signed-url-456");
      expect(result.expires).toBe(currentTime + 30);
    });

    it("should throw TRPCError when Pinata client fails", async () => {
      const mockPinataClient = {
        createSignedUploadUrl: mock(async () =>
          err({
            type: "ExternalApiError" as const,
            provider: "pinata" as const,
            message: "Pinata API error",
          }),
        ),
        convertToGatewayUrl: mock(async () => ok("https://gateway.pinata.cloud/ipfs/QmTest")),
      };

      const ctx = createMockContext({
        // @ts-expect-error - pinataClient is injected for testing
        pinataClient: mockPinataClient,
      });

      const caller = ipfsRouter.createCaller(ctx);

      await expect(
        caller.createSignedUploadUrl({
          filename: "test.glb",
          contentType: "application/octet-stream",
        }),
      ).rejects.toThrow();
    });
  });
});
