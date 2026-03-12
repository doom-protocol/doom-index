/**
 * ArDrive Client - Anti-Corruption Layer for @ardrive/turbo-sdk
 *
 * Provides type-safe wrapper around ArDrive Turbo SDK for Arweave uploads
 * Follows the same neverthrow Result<T, AppError> pattern as the rest of the codebase
 */

import { DEFAULT_ARWEAVE_GATEWAY_BASE_URL } from "@/constants/arweave";
import type { AppError } from "@/types/app-error";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";

type ArweaveJWK = import("@ardrive/turbo-sdk").ArweaveJWK;
type TurboAuthenticatedClient = import("@ardrive/turbo-sdk").TurboAuthenticatedClient;
type TurboBalanceResponse = import("@ardrive/turbo-sdk").TurboBalanceResponse;
type TurboCryptoFundResponse = import("@ardrive/turbo-sdk").TurboCryptoFundResponse;
type TurboFundWithTokensParams = import("@ardrive/turbo-sdk").TurboFundWithTokensParams;
type TurboPriceResponse = import("@ardrive/turbo-sdk").TurboPriceResponse;

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
  getBalance: () => Promise<Result<TurboBalanceResponse, AppError>>;
  getUploadCosts: (bytes: number[]) => Promise<Result<TurboPriceResponse[], AppError>>;
  topUpWithTokens: (params: TurboFundWithTokensParams) => Promise<Result<TurboCryptoFundResponse, AppError>>;
  uploadFile: (data: Buffer | Uint8Array, contentType: string, tags?: Tag[]) => Promise<Result<UploadResult, AppError>>;
  uploadJson: (json: object, tags?: Tag[]) => Promise<Result<UploadResult, AppError>>;
}

export interface CreateArdriveClientDeps {
  secretKey?: string;
  turboClient?: TurboAuthenticatedClient;
}

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

  const getClient = async (): Promise<Result<TurboAuthenticatedClient, AppError>> => {
    if (mockClient) return ok(mockClient);

    if (!secretKey) {
      return err({
        type: "ConfigurationError",
        message: "ARDRIVE_TURBO_SECRET_KEY environment variable is not set",
        missingVar: "ARDRIVE_TURBO_SECRET_KEY",
      });
    }

    try {
      const { TurboFactory } = await import("@ardrive/turbo-sdk");
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
    async getBalance(): Promise<Result<TurboBalanceResponse, AppError>> {
      const clientResult = await getClient();
      if (clientResult.isErr()) return err(clientResult.error);

      try {
        return ok(await clientResult.value.getBalance());
      } catch (error) {
        return err({
          type: "ExternalApiError",
          provider: "ardrive",
          message: `Failed to read Turbo balance: ${error instanceof Error ? error.message : "Unknown error"}`,
          details: error,
        });
      }
    },

    async getUploadCosts(bytes: number[]): Promise<Result<TurboPriceResponse[], AppError>> {
      const clientResult = await getClient();
      if (clientResult.isErr()) return err(clientResult.error);

      try {
        return ok(await clientResult.value.getUploadCosts({ bytes }));
      } catch (error) {
        return err({
          type: "ExternalApiError",
          provider: "ardrive",
          message: `Failed to estimate Turbo upload costs: ${error instanceof Error ? error.message : "Unknown error"}`,
          details: error,
        });
      }
    },

    async topUpWithTokens(params: TurboFundWithTokensParams): Promise<Result<TurboCryptoFundResponse, AppError>> {
      const clientResult = await getClient();
      if (clientResult.isErr()) return err(clientResult.error);

      try {
        return ok(await clientResult.value.topUpWithTokens(params));
      } catch (error) {
        return err({
          type: "ExternalApiError",
          provider: "ardrive",
          message: `Failed to top up Turbo balance: ${error instanceof Error ? error.message : "Unknown error"}`,
          details: error,
        });
      }
    },

    async uploadFile(
      data: Buffer | Uint8Array,
      contentType: string,
      tags?: Tag[],
    ): Promise<Result<UploadResult, AppError>> {
      const clientResult = await getClient();
      if (clientResult.isErr()) return err(clientResult.error);

      try {
        const turbo = clientResult.value;
        const allTags = buildDefaultTags(contentType, tags);
        const fileBytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        const { Readable } = await import("node:stream");

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
          url: `${DEFAULT_ARWEAVE_GATEWAY_BASE_URL}/${response.id}`,
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
