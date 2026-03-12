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
        url: "https://arweave.net/tx-123",
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
        url: "https://arweave.net/tx-json",
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
});
