import "../../preload";

import { DOOM_NFT_PROGRAM_ID, deriveGlobalConfigPda } from "@/lib/anchor/doom-nft-program";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Buffer } from "node:buffer";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PublicKey } from "@solana/web3.js";

mock.restore();

const textEncoder = new TextEncoder();
const INITIAL_TOKEN_ID = BigInt(42);
const RETRY_TOKEN_ID = BigInt(43);

function encodeU32LE(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function encodeU64LE(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, true);
  return bytes;
}

function encodeString(value: string): Uint8Array {
  const stringBytes = textEncoder.encode(value);
  return Uint8Array.from([...encodeU32LE(stringBytes.length), ...stringBytes]);
}

function createPublicKey(fillValue: number): PublicKey {
  return new PublicKey(new Uint8Array(32).fill(fillValue));
}

function buildGlobalConfigAccountData(params: {
  collection: PublicKey;
  collectionUpdateAuthority: PublicKey;
  mintPaused?: boolean;
  nextTokenId: bigint;
}): Buffer {
  const discriminator = Uint8Array.from([149, 8, 156, 202, 160, 252, 176, 217]);

  return Uint8Array.from([
    ...discriminator,
    ...createPublicKey(1).toBytes(),
    ...createPublicKey(2).toBytes(),
    ...encodeU64LE(params.nextTokenId),
    params.mintPaused ? 1 : 0,
    ...encodeString("https://arweave.net/manifest"),
    ...params.collection.toBytes(),
    ...params.collectionUpdateAuthority.toBytes(),
    255,
  ]) as Buffer;
}

const sendTransactionMock = mock(async () => {
  await Promise.resolve();
  return "sig-1";
});
const getAccountInfoMock = mock(async (_address: PublicKey) => {
  await Promise.resolve();
  return null as { data: Buffer } | null;
});
const getLatestBlockhashMock = mock(async () => {
  await Promise.resolve();
  return {
    blockhash: "9Wzyd8M5LE8P6J4s3FCq8nP4C5sVuk94suBT76cKiDH6",
    lastValidBlockHeight: 123,
  };
});
const confirmTransactionMock = mock(async () => {
  await Promise.resolve();
  return {
    context: { slot: 1 },
    value: { err: null },
  };
});
const walletState = {
  connected: true,
  publicKey: createPublicKey(9),
  sendTransaction: sendTransactionMock,
};
const connectionState = {
  confirmTransaction: confirmTransactionMock,
  getAccountInfo: getAccountInfoMock,
  getLatestBlockhash: getLatestBlockhashMock,
};
const readConnectionState = () => ({
  connection: connectionState,
});
const readWalletState = () => walletState;
const prepareMintMetadataMutateMock = mock(async () => {
  await Promise.resolve();
  return {
    baseMetadataUrl: "https://permagate.io/manifest",
    manifestTxId: "manifest-tx",
    metadataTxId: "metadata-tx",
    resolvedFromProbe: false,
    tokenMetadataUrl: "https://permagate.io/manifest/42",
  };
});

const readTRPCClient = () => ({
  paintings: {
    prepareMintMetadata: {
      mutate: prepareMintMetadataMutateMock,
    },
  },
});
const loggerWarnMock = mock(() => {});

function registerUseSolanaMintMocks() {
  void mock.module("@solana/wallet-adapter-react", () => ({
    ConnectionProvider: ({ children }: { children: unknown }) => children,
    WalletProvider: ({ children }: { children: unknown }) => children,
    useConnection: readConnectionState,
    useWallet: readWalletState,
  }));

  void mock.module("@/lib/trpc/client", () => ({
    useTRPCClient: readTRPCClient,
  }));

  void mock.module("@/utils/logger", () => ({
    logger: {
      debug: mock(() => {}),
      error: mock(() => {}),
      info: mock(() => {}),
      warn: loggerWarnMock,
    },
  }));
}

async function loadUseSolanaMintModule() {
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/hooks/use-solana-mint.ts"));
  moduleUrl.searchParams.set("test", `${String(Date.now())}-${String(Math.random())}`);
  return import(moduleUrl.href) as Promise<typeof import("../../../src/hooks/use-solana-mint")>;
}

describe("unit/hooks/use-solana-mint", () => {
  beforeEach(() => {
    mock.restore();
    registerUseSolanaMintMocks();
    prepareMintMetadataMutateMock.mockReset();
    prepareMintMetadataMutateMock.mockImplementation(async () => {
      await Promise.resolve();
      return {
        baseMetadataUrl: "https://permagate.io/manifest",
        manifestTxId: "manifest-tx",
        metadataTxId: "metadata-tx",
        resolvedFromProbe: false,
        tokenMetadataUrl: "https://permagate.io/manifest/42",
      };
    });
    sendTransactionMock.mockReset();
    sendTransactionMock.mockImplementation(async () => {
      await Promise.resolve();
      return "sig-1";
    });
    getAccountInfoMock.mockReset();
    getLatestBlockhashMock.mockReset();
    getLatestBlockhashMock.mockImplementation(async () => {
      await Promise.resolve();
      return {
        blockhash: "9Wzyd8M5LE8P6J4s3FCq8nP4C5sVuk94suBT76cKiDH6",
        lastValidBlockHeight: 123,
      };
    });
    confirmTransactionMock.mockReset();
    confirmTransactionMock.mockImplementation(async () => {
      await Promise.resolve();
      return {
        context: { slot: 1 },
        value: { err: null },
      };
    });
    walletState.connected = true;
    walletState.publicKey = createPublicKey(9);
    loggerWarnMock.mockReset();

    const globalConfig = deriveGlobalConfigPda();
    const collection = createPublicKey(21);
    const collectionUpdateAuthority = PublicKey.findProgramAddressSync(
      [textEncoder.encode("collection_authority"), globalConfig.toBytes()],
      DOOM_NFT_PROGRAM_ID,
    )[0];

    getAccountInfoMock.mockImplementation(async (address: PublicKey) => {
      await Promise.resolve();
      if (address.toBase58() !== globalConfig.toBase58()) {
        return null;
      }

      return {
        data: buildGlobalConfigAccountData({
          collection,
          collectionUpdateAuthority,
          nextTokenId: INITIAL_TOKEN_ID,
        }),
      };
    });
  });

  afterEach(() => {
    mock.restore();
  });

  afterAll(() => {
    mock.restore();
  });

  it("builds a reserve+mint transaction and returns the minted asset info", async () => {
    const globalConfig = deriveGlobalConfigPda();
    const collection = createPublicKey(21);
    const collectionUpdateAuthority = PublicKey.findProgramAddressSync(
      [textEncoder.encode("collection_authority"), globalConfig.toBytes()],
      DOOM_NFT_PROGRAM_ID,
    )[0];

    getAccountInfoMock.mockImplementation(async (address: PublicKey) => {
      await Promise.resolve();
      if (address.toBase58() !== globalConfig.toBase58()) {
        return null;
      }

      return {
        data: buildGlobalConfigAccountData({
          collection,
          collectionUpdateAuthority,
          nextTokenId: INITIAL_TOKEN_ID,
        }),
      };
    });

    const { useSolanaMint } = await loadUseSolanaMintModule();
    const { result } = renderHook(() => useSolanaMint());

    await waitFor(() => {
      expect(result.current.nextTokenId).toBe(INITIAL_TOKEN_ID);
    });

    let mintResult: Awaited<ReturnType<typeof result.current.mint>> | undefined;
    await act(async () => {
      mintResult = await result.current.mint("painting-42");
    });

    expect(prepareMintMetadataMutateMock).toHaveBeenCalledWith({
      paintingId: "painting-42",
      tokenId: INITIAL_TOKEN_ID.toString(),
    });
    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
    const [transaction, _connection, options] = sendTransactionMock.mock.calls[0] as unknown as [
      {
        instructions: Array<{
          data: Uint8Array;
        }>;
      },
      unknown,
      { signers: Array<{ publicKey: PublicKey }> },
    ];

    expect(transaction.instructions).toHaveLength(2);
    expect(Array.from(transaction.instructions[0].data)).toEqual([7, 8, 207, 40, 48, 69, 156, 194]);
    expect(Array.from(transaction.instructions[1].data)).toEqual([
      155, 84, 20, 249, 126, 6, 85, 218, 42, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(options.signers).toHaveLength(1);
    expect(confirmTransactionMock).toHaveBeenCalledTimes(1);
    expect(mintResult).toEqual({
      assetAddress: options.signers[0]?.publicKey.toBase58(),
      signature: "sig-1",
      tokenId: INITIAL_TOKEN_ID,
    });
  });

  it("treats an uninitialized global config as an empty mint state without warning", async () => {
    getAccountInfoMock.mockImplementation(async () => {
      await Promise.resolve();
      return null;
    });

    const { useSolanaMint } = await loadUseSolanaMintModule();
    const { result } = renderHook(() => useSolanaMint());

    await waitFor(() => {
      expect(result.current.nextTokenId).toBeNull();
    });

    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it("maps Doom program custom errors to user-facing mint errors", async () => {
    sendTransactionMock.mockImplementation(async () => {
      await Promise.resolve();
      throw new Error("custom program error: 0x1771");
    });

    const { useSolanaMint } = await loadUseSolanaMintModule();
    const { result } = renderHook(() => useSolanaMint());

    await waitFor(() => {
      expect(result.current.nextTokenId).toBe(INITIAL_TOKEN_ID);
    });

    let mintError: unknown;
    await act(async () => {
      try {
        await result.current.mint("painting-42");
      } catch (error) {
        mintError = error;
      }
    });

    expect(mintError).toBeInstanceOf(Error);
    expect((mintError as Error).message).toBe("Minting is currently paused.");
  });

  it("retries once with a refreshed token id when the reservation races", async () => {
    const globalConfig = deriveGlobalConfigPda();
    const collection = createPublicKey(21);
    const collectionUpdateAuthority = PublicKey.findProgramAddressSync(
      [textEncoder.encode("collection_authority"), globalConfig.toBytes()],
      DOOM_NFT_PROGRAM_ID,
    )[0];
    const tokenIds = [INITIAL_TOKEN_ID, INITIAL_TOKEN_ID, RETRY_TOKEN_ID];

    getAccountInfoMock.mockImplementation(async (address: PublicKey) => {
      await Promise.resolve();
      if (address.toBase58() !== globalConfig.toBase58()) {
        return null;
      }

      const nextTokenId = tokenIds.shift() ?? RETRY_TOKEN_ID;
      return {
        data: buildGlobalConfigAccountData({
          collection,
          collectionUpdateAuthority,
          nextTokenId,
        }),
      };
    });

    sendTransactionMock.mockImplementationOnce(async () => {
      await Promise.resolve();
      throw new Error("Transaction simulation failed: account already in use");
    });
    sendTransactionMock.mockImplementationOnce(async () => {
      await Promise.resolve();
      return "sig-2";
    });

    const { useSolanaMint } = await loadUseSolanaMintModule();
    const { result } = renderHook(() => useSolanaMint());

    await waitFor(() => {
      expect(result.current.nextTokenId).toBe(INITIAL_TOKEN_ID);
    });

    let mintResult: Awaited<ReturnType<typeof result.current.mint>> | undefined;
    await act(async () => {
      mintResult = await result.current.mint("painting-42");
    });

    expect(sendTransactionMock).toHaveBeenCalledTimes(2);
    const [retryTransaction] = sendTransactionMock.mock.calls[1] as unknown as [
      {
        instructions: Array<{ data: Uint8Array }>;
      },
      unknown,
      unknown,
    ];
    expect(Array.from(retryTransaction.instructions[1].data)).toEqual([
      155, 84, 20, 249, 126, 6, 85, 218, 43, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(mintResult?.signature).toBe("sig-2");
    expect(mintResult?.tokenId).toBe(RETRY_TOKEN_ID);
  });
});
