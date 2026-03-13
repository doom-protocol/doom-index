import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { ok } from "neverthrow";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type StorageModule = typeof import("@/server/services/paintings/storage");

async function loadStorageModule(): Promise<StorageModule> {
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/server/services/paintings/storage.ts"));
  moduleUrl.searchParams.set("test", `${String(Date.now())}-${String(Math.random())}`);
  return (await import(moduleUrl.href)) as StorageModule;
}

const getBalanceMock = mock(async () => {
  await Promise.resolve();
  return ok({
    currentBalanceWinc: BigInt(100),
    controlledWinc: "100",
    effectiveBalance: "100",
    givenApprovals: [],
    receivedApprovals: [],
    winc: "100",
  });
});
const getUploadCostsMock = mock(async () => {
  await Promise.resolve();
  return ok([{ adjustments: [], fees: [], winc: "1" }]);
});
const topUpWithTokensMock = mock(async () => {
  await Promise.resolve();
  return ok({
    id: "topup-tx",
    owner: "owner",
    quantity: "1",
    status: "confirmed",
    target: "target",
    token: "arweave",
    winc: "1",
  });
});
const uploadFileMock = mock(async () => {
  await Promise.resolve();
  return ok({
    dataCaches: [],
    fastFinalityIndexes: [],
    id: "image-tx",
    url: "https://permagate.io/image-tx",
  });
});

function registerStorageModuleMocks() {
  void mock.module("@/env", () => ({
    env: {
      ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON: undefined,
      ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC: undefined,
      ARDRIVE_TURBO_SECRET_KEY: '{"kty":"RSA"}',
      ARWEAVE_GATEWAY_BASE_URL: "https://preferred.example",
    },
  }));

  void mock.module("@/lib/ardrive-client", () => ({
    createArdriveClient: () => ({
      getBalance: getBalanceMock,
      getUploadCosts: getUploadCostsMock,
      topUpWithTokens: topUpWithTokensMock,
      uploadFile: uploadFileMock,
    }),
  }));
}

describe("unit/server/services/paintings/storage", () => {
  beforeEach(() => {
    registerStorageModuleMocks();
    getBalanceMock.mockClear();
    getUploadCostsMock.mockClear();
    topUpWithTokensMock.mockClear();
    uploadFileMock.mockClear();
  });

  afterEach(() => {
    mock.restore();
  });

  it("uploads only the image during recurring storage and skips GLB composition", async () => {
    const { storePaintingAssets } = await loadStorageModule();

    const result = await storePaintingAssets({
      imageBuffer: new Uint8Array([1, 2, 3]).buffer,
      imageContentType: "image/webp",
      paintingId: "painting-123",
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      imageTxId: "image-tx",
      imageUrl: "https://preferred.example/image-tx",
    });
    expect(uploadFileMock).toHaveBeenCalledTimes(1);
  });
});
