import "../../../preload";

import { DOOM_NFT_PROGRAM_ID, deriveGlobalConfigPda } from "@/lib/anchor/doom-nft-program";
import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { PublicKey } from "@solana/web3.js";
import type { FC, ReactNode } from "react";

const NEXT_TOKEN_ID = BigInt(7);
const WALLET_PUBLIC_KEY = new PublicKey(new Uint8Array(32).fill(9));
const textEncoder = new TextEncoder();

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
  nextTokenId: bigint;
}): Buffer {
  const discriminator = Uint8Array.from([149, 8, 156, 202, 160, 252, 176, 217]);

  return Uint8Array.from([
    ...discriminator,
    ...createPublicKey(1).toBytes(),
    ...createPublicKey(2).toBytes(),
    ...encodeU64LE(params.nextTokenId),
    0,
    ...encodeString("https://arweave.net/manifest"),
    ...params.collection.toBytes(),
    ...params.collectionUpdateAuthority.toBytes(),
    255,
  ]) as Buffer;
}

const connectWalletMock = mock(async () => {
  await Promise.resolve();
  return { ok: true };
});
const sendTransactionMock = mock(async () => {
  await Promise.resolve();
  return "sig";
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
const setVisibleMock = mock((_visible: boolean) => {});
const prepareMintMetadataMock = mock(async () => {
  await Promise.resolve();
  return {
    baseMetadataUrl: "https://permagate.io/manifest-tx",
    manifestTxId: "manifest-tx",
    metadataTxId: "metadata-tx",
    resolvedFromProbe: true,
    tokenMetadataUrl: "https://permagate.io/manifest-tx/7",
  };
});
const useWalletState = {
  wallet: null as { adapter: { name: string } } | null,
  connected: false,
  publicKey: null as PublicKey | null,
  sendTransaction: sendTransactionMock,
};
const solanaWalletState = {
  connected: false,
  connecting: false,
  publicKey: null as string | null,
};
const connectionState = {
  confirmTransaction: confirmTransactionMock,
  getAccountInfo: getAccountInfoMock,
  getLatestBlockhash: getLatestBlockhashMock,
};
const readSolanaWallet = () => ({
  connectWallet: connectWalletMock,
  connected: solanaWalletState.connected,
  connecting: solanaWalletState.connecting,
  publicKey: solanaWalletState.publicKey,
});
const readWallet = () => useWalletState;
const readConnection = () => ({
  connection: connectionState,
});
const readWalletModal = () => ({
  setVisible: setVisibleMock,
});
const readHaptic = () => ({
  triggerHaptic: mock(() => {}),
});

void mock.module("@/hooks/use-solana-wallet", () => ({
  useSolanaWallet: readSolanaWallet,
}));

void mock.module("@solana/wallet-adapter-react", () => ({
  useConnection: readConnection,
  useWallet: readWallet,
}));

void mock.module("@solana/wallet-adapter-react-ui", () => ({
  useWalletModal: readWalletModal,
}));

void mock.module("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

void mock.module("@react-three/drei", () => ({
  OrbitControls: () => null,
}));

void mock.module("@/components/gallery/framed-painting", () => ({
  FramedPainting: () => <div data-testid="framed-painting" />,
}));

void mock.module("@/components/gallery/lights", () => ({
  Lights: () => null,
}));

void mock.module("@/lib/analytics", () => ({
  GA_EVENTS: {
    MINT_SUCCESS: "mint_success",
    MINT_TRANSACTION_START: "mint_transaction_start",
  },
  sendGAEvent: mock(() => {}),
}));

const readTRPCClient = () => ({
  paintings: {
    prepareMintMetadata: {
      mutate: prepareMintMetadataMock,
    },
  },
});

void mock.module("@/lib/trpc/client", () => ({
  useTRPCClient: readTRPCClient,
}));

void mock.module("@/utils/logger", () => ({
  logger: {
    debug: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
  },
}));

void mock.module("@/utils/error", () => ({
  getErrorMessage: () => "Minting failed",
}));

void mock.module("sonner", () => ({
  toast: {
    error: mock(() => {}),
    info: mock(() => {}),
    success: mock(() => {}),
  },
}));

void mock.module("use-haptic", () => ({
  useHaptic: readHaptic,
}));

describe("unit/components/ui/mint-modal", () => {
  beforeEach(() => {
    connectWalletMock.mockClear();
    sendTransactionMock.mockClear();
    getAccountInfoMock.mockClear();
    getLatestBlockhashMock.mockClear();
    confirmTransactionMock.mockClear();
    setVisibleMock.mockClear();
    prepareMintMetadataMock.mockClear();
    useWalletState.wallet = null;
    useWalletState.connected = false;
    useWalletState.publicKey = null;
    solanaWalletState.connected = false;
    solanaWalletState.connecting = false;
    solanaWalletState.publicKey = null;

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
          nextTokenId: NEXT_TOKEN_ID,
        }),
      };
    });
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    mock.restore();
  });

  it("opens the wallet selector when no wallet is selected", async () => {
    const { MintModal } = await import("@/components/ui/mint-modal");

    const { getByRole } = render(
      <MintModal
        isOpen={true}
        onClose={() => {}}
        paintingMetadata={{
          timestamp: "2026-03-12T00:00:00.000Z",
          paintingHash: "abcd1234",
          thumbnailUrl: "/painting.webp",
        }}
      />,
    );

    fireEvent.click(getByRole("button", { name: /connect wallet/i }));

    await waitFor(() => {
      expect(setVisibleMock).toHaveBeenCalledWith(true);
      expect(connectWalletMock).not.toHaveBeenCalled();
    });
  });

  it("calls connectWallet when a wallet is already selected", async () => {
    const { MintModal } = await import("@/components/ui/mint-modal");
    useWalletState.wallet = {
      adapter: {
        name: "Phantom",
      },
    };

    const { getByRole } = render(
      <MintModal
        isOpen={true}
        onClose={() => {}}
        paintingMetadata={{
          timestamp: "2026-03-12T00:00:00.000Z",
          paintingHash: "abcd1234",
          thumbnailUrl: "/painting.webp",
        }}
      />,
    );

    fireEvent.click(getByRole("button", { name: /connect wallet/i }));

    await waitFor(() => {
      expect(connectWalletMock).toHaveBeenCalledTimes(1);
      expect(setVisibleMock).not.toHaveBeenCalled();
    });
  });

  it("shows the real mint button once the wallet is connected", async () => {
    const { MintModal } = await import("@/components/ui/mint-modal");
    solanaWalletState.connected = true;
    solanaWalletState.publicKey = "user111111111111111111111111111111111111111";
    useWalletState.connected = true;
    useWalletState.publicKey = WALLET_PUBLIC_KEY;

    const { getByRole, queryByRole, queryByText } = render(
      <MintModal
        isOpen={true}
        onClose={() => {}}
        paintingMetadata={{
          timestamp: "2026-03-12T00:00:00.000Z",
          paintingHash: "abcd1234",
          thumbnailUrl: "/painting.webp",
        }}
      />,
    );

    expect(queryByRole("button", { name: /connect wallet/i })).toBeNull();
    expect(queryByText(/coming soon/i)).toBeNull();
    expect(getByRole("button", { name: /^mint$/i })).toBeEnabled();
  });

  it("calls mint when the connected-state mint button is pressed", async () => {
    const { MintModal } = await import("@/components/ui/mint-modal");
    solanaWalletState.connected = true;
    solanaWalletState.publicKey = "user111111111111111111111111111111111111111";
    useWalletState.connected = true;
    useWalletState.publicKey = WALLET_PUBLIC_KEY;

    const { getByRole } = render(
      <MintModal
        isOpen={true}
        onClose={() => {}}
        paintingMetadata={{
          timestamp: "2026-03-12T00:00:00.000Z",
          paintingHash: "abcd1234",
          thumbnailUrl: "/painting.webp",
        }}
      />,
    );

    await waitFor(() => {
      expect(prepareMintMetadataMock).not.toHaveBeenCalled();
    });

    fireEvent.click(getByRole("button", { name: /^mint$/i }));

    await waitFor(() => {
      expect(sendTransactionMock).toHaveBeenCalledTimes(1);
      expect(prepareMintMetadataMock).toHaveBeenCalled();
    });

    const preparationPayloads = (
      prepareMintMetadataMock.mock.calls as unknown as Array<[{ paintingId: string; tokenId: string }]>
    ).map(([payload]) => payload);

    expect(preparationPayloads.length).toBeGreaterThan(0);
    expect(preparationPayloads.every((payload) => payload.paintingId === "abcd1234")).toBe(true);
    expect(preparationPayloads.every((payload) => typeof payload.tokenId === "string")).toBe(true);
  });
});
