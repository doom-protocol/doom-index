/**
 * ArDrive Client - Anti-Corruption Layer for @ardrive/turbo-sdk
 *
 * Provides type-safe wrapper around ArDrive Turbo SDK for Arweave uploads
 * Follows the same neverthrow Result<T, AppError> pattern as the rest of the codebase
 */

import type { AppError } from "@/types/app-error";
import { TurboFactory } from "@ardrive/turbo-sdk";
import { Readable } from "node:stream";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";

type ArweaveJWK = import("@ardrive/turbo-sdk").ArweaveJWK;
type TurboAuthenticatedClient = import("@ardrive/turbo-sdk").TurboAuthenticatedClient;

export interface UploadResult {
  dataCaches: string[];
  fastFinalityIndexes: string[];
  id: string;
  url: string;
}

export interface Tag {
  name: string;
  value: string;
}

export interface ArdriveClient {
  uploadFile: (data: Buffer | Uint8Array, contentType: string, tags?: Tag[]) => Promise<Result<UploadResult, AppError>>;
  uploadJson: (json: object, tags?: Tag[]) => Promise<Result<UploadResult, AppError>>;
}

export interface CreateArdriveClientDeps {
  secretKey?: string;
  turboClient?: TurboAuthenticatedClient;
}

const ARWEAVE_GATEWAY = "https://arweave.net";
const JSON_ENCODER = new TextEncoder();

function buildDefaultTags(contentType: string, extraTags?: Tag[]): Tag[] {
  const tags: Tag[] = [
    { name: "App-Name", value: "DOOM-INDEX" },
    { name: "Content-Type", value: contentType },
  ];
  if (extraTags) {
    tags.push(...extraTags);
  }
  return tags;
}

export function createArdriveClient(deps: CreateArdriveClientDeps = {}): ArdriveClient {
  const { secretKey, turboClient: mockClient } = deps;

  const getClient = (): Result<TurboAuthenticatedClient, AppError> => {
    if (mockClient) return ok(mockClient);

    if (!secretKey) {
      return err({
        type: "ConfigurationError",
        message: "ARDRIVE_TURBO_SECRET_KEY environment variable is not set",
        missingVar: "ARDRIVE_TURBO_SECRET_KEY",
      });
    }

    try {
      const jwk = JSON.parse(secretKey) as ArweaveJWK;
      const client = TurboFactory.authenticated({ privateKey: jwk });
      return ok(client);
    } catch (error) {
      return err({
        type: "ConfigurationError",
        message: `Failed to parse ARDRIVE_TURBO_SECRET_KEY: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  };

  return {
    async uploadFile(
      data: Buffer | Uint8Array,
      contentType: string,
      tags?: Tag[],
    ): Promise<Result<UploadResult, AppError>> {
      const clientResult = getClient();
      if (clientResult.isErr()) return err(clientResult.error);

      try {
        const turbo = clientResult.value;
        const allTags = buildDefaultTags(contentType, tags);
        const fileBytes = data instanceof Uint8Array ? data : new Uint8Array(data);

        const response = await turbo.uploadFile({
          fileStreamFactory: () => Readable.from([fileBytes]),
          fileSizeFactory: () => fileBytes.byteLength,
          dataItemOpts: {
            tags: allTags.map((t) => ({ name: t.name, value: t.value })),
          },
        });

        return ok({
          dataCaches: response.dataCaches,
          fastFinalityIndexes: response.fastFinalityIndexes,
          id: response.id,
          url: `${ARWEAVE_GATEWAY}/${response.id}`,
        });
      } catch (error) {
        return err({
          type: "ExternalApiError",
          provider: "ardrive",
          message: `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`,
          details: error,
        });
      }
    },

    async uploadJson(json: object, tags?: Tag[]): Promise<Result<UploadResult, AppError>> {
      const jsonString = JSON.stringify(json);
      const data = JSON_ENCODER.encode(jsonString);
      return this.uploadFile(data, "application/json", tags);
    },
  };
}
