import "../../../preload";

import { DOOM_NFT_PROGRAM_ID, deriveGlobalConfigPda } from "@/lib/anchor/doom-nft-program";
import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PublicKey } from "@solana/web3.js";
import type { FC, ReactNode } from "react";

const NEXT_TOKEN_ID = BigInt(7);
const WALLET_PUBLIC_KEY = new PublicKey(new Uint8Array(32).fill(9));
const textEncoder = new TextEncoder();
const MASKED_WALLET_PUBLIC_KEY = "user...1111";

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
const mintMock = mock(async (paintingId: string) => {
  await Promise.resolve();

  return {
    assetAddress: "asset-address",
    signature: "signature",
    tokenId: NEXT_TOKEN_ID,
    paintingId,
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
const triggerHapticMock = mock(() => {});
const readHaptic = () => ({
  triggerHaptic: triggerHapticMock,
});
const readSolanaMint = () => ({
  error: null,
  isMinting: false,
  mint: mintMock,
  nextTokenId: NEXT_TOKEN_ID,
  refreshMintState: mock(async () => {}),
});
const loggerDebugMock = mock(() => {});
const loggerErrorMock = mock(() => {});
const loggerInfoMock = mock(() => {});
const loggerWarnMock = mock(() => {});

function registerMintModalMocks() {
  void mock.module("@/hooks/use-solana-wallet", () => ({
    useSolanaWallet: readSolanaWallet,
  }));

  void mock.module("@/hooks/use-solana-mint", () => ({
    useSolanaMint: readSolanaMint,
  }));

  void mock.module("@solana/wallet-adapter-react", () => ({
    ConnectionProvider: ({ children }: { children: ReactNode }): ReactNode => children,
    WalletProvider: ({ children }: { children: ReactNode }): ReactNode => children,
    useConnection: readConnection,
    useWallet: readWallet,
  }));

  void mock.module("@solana/wallet-adapter-react-ui", () => ({
    WalletModalProvider: ({ children }: { children: ReactNode }): ReactNode => children,
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
      MINT_WALLET_CONNECT: "mint_wallet_connect",
    },
    sendGAEvent: mock(() => {}),
  }));

  void mock.module("@/utils/logger", () => ({
    logger: {
      debug: loggerDebugMock,
      error: loggerErrorMock,
      info: loggerInfoMock,
      warn: loggerWarnMock,
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
}

async function loadMintModalModule() {
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/components/ui/mint-modal.tsx"));
  moduleUrl.searchParams.set("test", `${String(Date.now())}-${String(Math.random())}`);
  return import(moduleUrl.href) as Promise<typeof import("@/components/ui/mint-modal")>;
}

describe("unit/components/ui/mint-modal", () => {
  beforeEach(() => {
    mock.restore();
    registerMintModalMocks();
    connectWalletMock.mockClear();
    sendTransactionMock.mockClear();
    getAccountInfoMock.mockClear();
    getLatestBlockhashMock.mockClear();
    confirmTransactionMock.mockClear();
    setVisibleMock.mockClear();
    mintMock.mockClear();
    triggerHapticMock.mockClear();
    loggerDebugMock.mockClear();
    loggerErrorMock.mockClear();
    loggerInfoMock.mockClear();
    loggerWarnMock.mockClear();
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
    mock.restore();
  });

  afterAll(() => {
    mock.restore();
  });

  it("opens the wallet selector when no wallet is selected", async () => {
    const { MintModal } = await loadMintModalModule();

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

    expect(triggerHapticMock).toHaveBeenCalledTimes(1);

    expect(loggerDebugMock).toHaveBeenCalledWith(
      "mint.modal.connect-clicked",
      expect.objectContaining({
        connected: false,
        connecting: false,
        hasSelectedWallet: false,
        publicKey: null,
        selectedWalletName: null,
      }),
    );
    expect(loggerDebugMock).toHaveBeenCalledWith(
      "mint.modal.wallet-selector.opened",
      expect.objectContaining({
        hasSelectedWallet: false,
        selectedWalletName: null,
      }),
    );
  });

  it("calls connectWallet when a wallet is already selected", async () => {
    const { MintModal } = await loadMintModalModule();
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

    expect(triggerHapticMock).toHaveBeenCalledTimes(1);
  });

  it("logs wallet adapter state when the modal is opened and reopened", async () => {
    const { MintModal } = await loadMintModalModule();
    useWalletState.wallet = {
      adapter: {
        name: "Phantom",
      },
    };

    const { rerender } = render(
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
      expect(loggerDebugMock).toHaveBeenCalledWith(
        "mint.modal.opened",
        expect.objectContaining({
          connected: false,
          connecting: false,
          openReason: "initial-open",
          publicKey: null,
          selectedWalletName: "Phantom",
        }),
      );
      expect(loggerDebugMock).toHaveBeenCalledWith(
        "mint.modal.wallet-state",
        expect.objectContaining({
          isOpen: true,
          selectedWalletName: "Phantom",
        }),
      );
    });

    rerender(
      <MintModal
        isOpen={false}
        onClose={() => {}}
        paintingMetadata={{
          timestamp: "2026-03-12T00:00:00.000Z",
          paintingHash: "abcd1234",
          thumbnailUrl: "/painting.webp",
        }}
      />,
    );

    solanaWalletState.connected = true;
    solanaWalletState.connecting = false;
    solanaWalletState.publicKey = "user111111111111111111111111111111111111111";
    useWalletState.connected = true;
    useWalletState.publicKey = WALLET_PUBLIC_KEY;

    rerender(
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
      expect(loggerDebugMock).toHaveBeenCalledWith(
        "mint.modal.opened",
        expect.objectContaining({
          connected: true,
          connecting: false,
          openReason: "reopen",
          publicKey: MASKED_WALLET_PUBLIC_KEY,
          selectedWalletName: "Phantom",
        }),
      );
      expect(loggerDebugMock).toHaveBeenCalledWith(
        "mint.modal.wallet-state",
        expect.objectContaining({
          connected: true,
          isOpen: true,
          publicKey: MASKED_WALLET_PUBLIC_KEY,
          selectedWalletName: "Phantom",
        }),
      );
    });
  });

  it("shows the real mint button once the wallet is connected", async () => {
    const { MintModal } = await loadMintModalModule();
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
    expect(queryByText("DOOM NFT #7")).not.toBeNull();
    expect(getByRole("button", { name: /^mint$/i })).toBeEnabled();
  });

  it("calls mint when the connected-state mint button is pressed", async () => {
    const { MintModal } = await loadMintModalModule();
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

    fireEvent.click(getByRole("button", { name: /^mint$/i }));

    await waitFor(() => {
      expect(mintMock).toHaveBeenCalledWith("abcd1234");
    });

    expect(triggerHapticMock).toHaveBeenCalledTimes(1);
  });
});
