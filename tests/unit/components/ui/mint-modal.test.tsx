import "../../../preload";

import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { FC, ReactNode } from "react";

const connectWalletMock = mock(async () => {
  await Promise.resolve();
  return { ok: true };
});
const setVisibleMock = mock((_visible: boolean) => {});
const useWalletState = {
  wallet: null as { adapter: { name: string } } | null,
};
const readSolanaWallet = () => ({
  connectWallet: connectWalletMock,
  connected: false,
  connecting: false,
  publicKey: null,
});
const readWallet = () => useWalletState;
const readWalletModal = () => ({
  setVisible: setVisibleMock,
});
const readSolanaMint = () => ({
  mint: mock(async () => {
    await Promise.resolve();
    return { mintAddress: "mint", signature: "sig" };
  }),
  isMinting: false,
});
const readIpfsUpload = () => ({
  uploadGlbAndMetadata: mock(async () => {
    await Promise.resolve();
    return { cidGlb: "cid-glb", cidMetadata: "cid-metadata" };
  }),
  isUploading: false,
});
const readHaptic = () => ({
  triggerHaptic: mock(() => {}),
});

void mock.module("@/hooks/use-solana-wallet", () => ({
  useSolanaWallet: readSolanaWallet,
}));

void mock.module("@solana/wallet-adapter-react", () => ({
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

void mock.module("@/hooks/use-solana-mint", () => ({
  useSolanaMint: readSolanaMint,
}));

void mock.module("@/hooks/use-ipfs-upload", () => ({
  useIpfsUpload: readIpfsUpload,
}));

void mock.module("@/lib/analytics", () => ({
  GA_EVENTS: {
    MINT_SUCCESS: "mint_success",
    MINT_TRANSACTION_START: "mint_transaction_start",
  },
  sendGAEvent: mock(() => {}),
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
    setVisibleMock.mockClear();
    useWalletState.wallet = null;
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
        glbFile={null}
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
        glbFile={null}
      />,
    );

    fireEvent.click(getByRole("button", { name: /connect wallet/i }));

    await waitFor(() => {
      expect(connectWalletMock).toHaveBeenCalledTimes(1);
      expect(setVisibleMock).not.toHaveBeenCalled();
    });
  });
});
