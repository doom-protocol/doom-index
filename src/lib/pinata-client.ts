/**
 * Pinata Client - Anti-Corruption Layer for Pinata SDK
 *
 * Provides type-safe wrapper around Pinata SDK for IPFS uploads
 * Handles signed URL generation and gateway URL conversion
 */

import { PinataSDK } from "pinata";
import { err, ok, type Result } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { env } from "@/env";

/**
 * Options for creating signed upload URL
 */
export interface CreateSignedUrlOptions {
  expires: number; // Seconds
  name: string;
  keyvalues?: Record<string, string>;
  group?: string;
}

/**
 * Signed URL response
 */
export interface SignedUrl {
  url: string;
  expires: number; // Unix timestamp
}

/**
 * Pinata Client interface
 */
export interface PinataClient {
  createSignedUploadUrl(options: CreateSignedUrlOptions): Promise<Result<SignedUrl, AppError>>;
  convertToGatewayUrl(cid: string): Promise<Result<string, AppError>>;
}

/**
 * Dependencies for creating Pinata client
 */
export interface CreatePinataClientDeps {
  apiKey?: string;
  pinataClient?: PinataSDK;
}

/**
 * Create Pinata client with dependency injection
 *
 * @param deps - Dependencies (apiKey, pinataClient for testing)
 * @returns PinataClient instance
 */
export function createPinataClient(deps: CreatePinataClientDeps = {}): PinataClient {
  const { apiKey, pinataClient: mockClient } = deps;

  return {
    async createSignedUploadUrl(options: CreateSignedUrlOptions): Promise<Result<SignedUrl, AppError>> {
      // Validate API key
      const key = apiKey ?? env.PINATA_JWT;
      if (!key) {
        return err({
          type: "ConfigurationError",
          message: "PINATA_JWT environment variable is not set",
        });
      }

      try {
        // Use mock client for testing, or create real client
        const client = mockClient ?? new PinataSDK({ pinataJwt: key });

        // Calculate expiration timestamp (current time + expires seconds)
        const expiresAt = Math.floor(Date.now() / 1000) + options.expires;

        // Call Pinata SDK - returns the signed URL as a string
        const url = await client.upload.public.createSignedURL({
          expires: options.expires,
          name: options.name,
          keyvalues: options.keyvalues,
          groupId: options.group,
        });

        return ok({
          url,
          expires: expiresAt,
        });
      } catch (error) {
        return err({
          type: "ExternalApiError",
          provider: "pinata",
          message: `Failed to create signed upload URL: ${error instanceof Error ? error.message : "Unknown error"}`,
          details: error,
        });
      }
    },

    async convertToGatewayUrl(cid: string): Promise<Result<string, AppError>> {
      // Validate API key
      const key = apiKey ?? env.PINATA_JWT;
      if (!key) {
        return err({
          type: "ConfigurationError",
          message: "PINATA_JWT environment variable is not set",
        });
      }

      try {
        // Use mock client for testing, or create real client
        const client = mockClient ?? new PinataSDK({ pinataJwt: key });

        // Call Pinata SDK - convert IPFS URL to gateway URL
        const ipfsUrl = `ipfs://${cid}`;
        const gatewayUrl = await client.gateways.public.convert(ipfsUrl);

        return ok(gatewayUrl);
      } catch (error) {
        return err({
          type: "ExternalApiError",
          provider: "pinata",
          message: `Failed to convert CID to gateway URL: ${error instanceof Error ? error.message : "Unknown error"}`,
          details: { cid, error },
        });
      }
    },
  };
}
