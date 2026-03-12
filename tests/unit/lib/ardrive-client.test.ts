import { createArdriveClient } from "@/lib/ardrive-client";
import { describe, expect, it, mock } from "bun:test";
import type { Readable } from "node:stream";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

async function readReadableStream(stream: Readable): Promise<string> {
  const chunks: Uint8Array[] = [];

  for await (const rawChunk of stream as AsyncIterable<unknown>) {
    if (typeof rawChunk === "string") {
      chunks.push(TEXT_ENCODER.encode(rawChunk));
      continue;
    }

    if (rawChunk instanceof Uint8Array) {
      chunks.push(rawChunk);
      continue;
    }

    throw new TypeError("Unexpected chunk from ArDrive upload stream");
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return TEXT_DECODER.decode(combined);
}

describe("unit/lib/ardrive-client", () => {
  it("returns a configuration error when the Turbo secret key is missing", async () => {
    const client = createArdriveClient();

    const result = await client.uploadFile(TEXT_ENCODER.encode("doom"), "image/png");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("ConfigurationError");
      expect(result.error.message).toContain("ARDRIVE_TURBO_SECRET_KEY");
    }
  });

  it("uploads files with default and extra Arweave tags", async () => {
    const uploadFile = mock(async (_params: unknown) =>
      Promise.resolve({
        dataCaches: [],
        fastFinalityIndexes: [],
        id: "tx-123",
        owner: "owner",
        winc: "1",
      }),
    );

    const client = createArdriveClient({
      turboClient: {
        uploadFile,
      } as never,
    });

    const result = await client.uploadFile(TEXT_ENCODER.encode("doom"), "image/png", [
      { name: "Painting-Id", value: "painting-1" },
      { name: "File-Type", value: "thumbnail" },
    ]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        dataCaches: [],
        fastFinalityIndexes: [],
        id: "tx-123",
        url: "https://permagate.io/tx-123",
      });
    }

    expect(uploadFile).toHaveBeenCalledTimes(1);
    const firstCall = uploadFile.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const params = firstCall?.[0];
    expect(params).toBeDefined();
    const typedParams = params as {
      dataItemOpts?: {
        tags?: Array<{ name: string; value: string }>;
      };
      fileSizeFactory: () => number;
      fileStreamFactory: () => Readable;
    };

    expect(typedParams.fileSizeFactory()).toBe(4);
    const uploadedContents = await readReadableStream(typedParams.fileStreamFactory());
    expect(uploadedContents).toBe("doom");
    expect(typedParams.dataItemOpts?.tags).toEqual([
      { name: "App-Name", value: "DOOM-INDEX" },
      { name: "Content-Type", value: "image/png" },
      { name: "Painting-Id", value: "painting-1" },
      { name: "File-Type", value: "thumbnail" },
    ]);
  });

  it("serializes JSON uploads as application/json", async () => {
    const uploadFile = mock(async (_params: unknown) =>
      Promise.resolve({
        dataCaches: [],
        fastFinalityIndexes: [],
        id: "tx-json",
        owner: "owner",
        winc: "1",
      }),
    );

    const client = createArdriveClient({
      turboClient: {
        uploadFile,
      } as never,
    });

    const result = await client.uploadJson({ hello: "doom" }, [{ name: "File-Type", value: "metadata" }]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        dataCaches: [],
        fastFinalityIndexes: [],
        id: "tx-json",
        url: "https://permagate.io/tx-json",
      });
    }

    const firstCall = uploadFile.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const params = firstCall?.[0];
    expect(params).toBeDefined();
    const typedParams = params as {
      dataItemOpts?: {
        tags?: Array<{ name: string; value: string }>;
      };
      fileStreamFactory: () => Readable;
    };

    const uploadedJson = await readReadableStream(typedParams.fileStreamFactory());
    expect(uploadedJson).toBe(JSON.stringify({ hello: "doom" }));
    expect(typedParams.dataItemOpts?.tags).toEqual([
      { name: "App-Name", value: "DOOM-INDEX" },
      { name: "Content-Type", value: "application/json" },
      { name: "File-Type", value: "metadata" },
    ]);
  });

  it("reuses the authenticated Turbo client across calls", async () => {
    const authenticatedClient = {
      getBalance: mock(async () => {
        await Promise.resolve();
        return {
          controlledWinc: "1",
          effectiveBalance: "1",
          givenApprovals: [],
          receivedApprovals: [],
          winc: "1",
        };
      }),
      getUploadCosts: mock(async () => {
        await Promise.resolve();
        return [{ adjustments: [], fees: [], winc: "2" }];
      }),
    };
    const authenticatedMock = mock(() => authenticatedClient);

    void mock.module("@ardrive/turbo-sdk", () => ({
      TurboFactory: {
        authenticated: authenticatedMock,
      },
    }));

    const client = createArdriveClient({
      secretKey: JSON.stringify({ kty: "RSA" }),
    });

    const balanceResult = await client.getBalance();
    const costResult = await client.getUploadCosts([1024]);

    expect(balanceResult.isOk()).toBe(true);
    expect(costResult.isOk()).toBe(true);
    expect(authenticatedMock).toHaveBeenCalledTimes(1);
  });

  it("reads Turbo balance and upload costs through the wrapper", async () => {
    const getBalance = mock(async () =>
      Promise.resolve({
        controlledWinc: "200",
        effectiveBalance: "200",
        givenApprovals: [],
        receivedApprovals: [],
        winc: "200",
      }),
    );
    const getUploadCosts = mock(async () => Promise.resolve([{ adjustments: [], fees: [], winc: "25" }]));

    const client = createArdriveClient({
      turboClient: {
        getBalance,
        getUploadCosts,
      } as never,
    });

    const balanceResult = await client.getBalance();
    expect(balanceResult.isOk()).toBe(true);
    if (balanceResult.isOk()) {
      expect(balanceResult.value.winc).toBe("200");
    }

    const costResult = await client.getUploadCosts([1024]);
    expect(costResult.isOk()).toBe(true);
    if (costResult.isOk()) {
      expect(costResult.value).toEqual([{ adjustments: [], fees: [], winc: "25" }]);
    }
  });

  it("tops up Turbo balance with the configured token amount", async () => {
    const topUpWithTokens = mock(async (_params: unknown) =>
      Promise.resolve({
        id: "fund-1",
        quantity: "5000",
        owner: "owner",
        status: "confirmed",
        target: "target-wallet",
        token: "arweave",
        winc: "900",
      }),
    );

    const client = createArdriveClient({
      turboClient: {
        topUpWithTokens,
      } as never,
    });

    const result = await client.topUpWithTokens({ tokenAmount: "5000" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe("fund-1");
      expect(result.value.winc).toBe("900");
    }
    expect(topUpWithTokens).toHaveBeenCalledWith({ tokenAmount: "5000" });
  });
});
