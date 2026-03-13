"use client";

/**
 * Mint Modal Component
 *
 * Simple, conversion-focused minting UI with 3D preview, price, and mint button
 */

import { MintPaintingPreviewScene } from "@/components/ui/mint-painting-preview-scene";
import { useSolanaMint } from "@/hooks/use-solana-mint";
import { useSolanaWallet } from "@/hooks/use-solana-wallet";
import { GA_EVENTS, sendGAEvent } from "@/lib/analytics";
import { getErrorMessage } from "@/utils/error";
import { logger } from "@/utils/logger";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { toast } from "sonner";
import type { Group } from "three";
import { useHaptic } from "use-haptic";

export interface MintModalProps {
  isOpen: boolean;
  onClose: () => void;
  paintingMetadata: {
    timestamp: string;
    paintingHash: string;
    thumbnailUrl: string;
  };
}

const MintModalBody: FC<MintModalProps> = ({ isOpen, onClose, paintingMetadata }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMintCompleted, setIsMintCompleted] = useState(false);
  const [mintedTokenId, setMintedTokenId] = useState<bigint | null>(null);
  const paintingRef = useRef<Group>(null);

  const wallet = useWallet();
  const { connectWallet, connected, connecting: isWalletConnecting, publicKey } = useSolanaWallet();
  const { setVisible } = useWalletModal();
  const { mint, isMinting, nextTokenId } = useSolanaMint();
  const { triggerHaptic } = useHaptic();
  const hasOpenedRef = useRef(false);

  // Mock price (in SOL)
  const MINT_PRICE = 0.1;
  const selectedWalletName = wallet.wallet?.adapter.name ?? null;
  const walletDebugStateRef = useRef({
    connected,
    connecting: isWalletConnecting,
    hasSelectedWallet: wallet.wallet !== null,
    publicKey,
    selectedWalletName,
  });

  walletDebugStateRef.current = {
    connected,
    connecting: isWalletConnecting,
    hasSelectedWallet: wallet.wallet !== null,
    publicKey,
    selectedWalletName,
  };

  useEffect(() => {
    logger.debug("mint.modal.wallet-state", {
      ...walletDebugStateRef.current,
      isOpen,
    });
  }, [connected, isOpen, isWalletConnecting, publicKey, selectedWalletName, wallet.wallet]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    logger.debug("mint.modal.opened", {
      ...walletDebugStateRef.current,
      openReason: hasOpenedRef.current ? "reopen" : "initial-open",
    });
    hasOpenedRef.current = true;
  }, [isOpen]);

  // Handle wallet connection
  const handleConnectWallet = useCallback(async () => {
    const currentWalletDebugState = walletDebugStateRef.current;

    logger.debug("mint.modal.connect-clicked", currentWalletDebugState);
    sendGAEvent(GA_EVENTS.MINT_WALLET_CONNECT);

    if (!wallet.wallet) {
      logger.debug("mint.modal.wallet-selector.opened", currentWalletDebugState);
      setVisible(true);
      return;
    }

    await connectWallet();
  }, [connectWallet, setVisible, wallet.wallet]);

  // Handle complete mint flow
  const handleMint = useCallback(async () => {
    if (!connected) {
      setVisible(true);
      return;
    }

    setIsProcessing(true);

    try {
      sendGAEvent(GA_EVENTS.MINT_TRANSACTION_START);
      const result = await mint();

      logger.info("mint.success", {
        assetAddress: result.assetAddress,
        signature: result.signature,
        tokenId: result.tokenId.toString(),
        walletAddress: publicKey,
      });

      setMintedTokenId(result.tokenId);
      setIsMintCompleted(true);
      sendGAEvent(GA_EVENTS.MINT_SUCCESS);
      toast.success("NFT minted successfully!");

      setTimeout(() => {
        setIsProcessing(false);
        setIsMintCompleted(false);
        onClose();
      }, 2000);
    } catch (error) {
      logger.error("mint.failed", { error });
      const errorMessage = getErrorMessage(error) || "Minting failed";
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [connected, setVisible, mint, onClose, publicKey]);

  // Handle modal close
  const handleClose = useCallback(() => {
    setIsProcessing(false);
    onClose();
    triggerHaptic();
  }, [onClose, triggerHaptic]);

  const isLoading = isMinting || isWalletConnecting || isProcessing;
  const displayTokenId = mintedTokenId ?? (typeof nextTokenId === "bigint" ? nextTokenId : null);
  const mintStatusLabel = displayTokenId === null ? "Loading next token id..." : "Ready to mint on Solana";

  const collectionName = displayTokenId === null ? "DOOM INDEX NFT" : `DOOM INDEX #${displayTokenId.toString()}`;

  return (
    <div
      className={`liquid-glass-effect cubic-bezier(0.32, 0.72, 0, 1) relative my-auto w-full max-w-2xl overflow-hidden rounded-[16px] border border-white/15 bg-black/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-500 sm:rounded-[24px] ${
        isOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-8 scale-95 opacity-0"
      }`}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={handleClose}
        className="absolute top-3 right-3 z-10 flex h-10 w-10 cursor-pointer touch-manipulation items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all hover:bg-white/20 active:scale-95 sm:top-4 sm:right-4 sm:h-8 sm:w-8 sm:hover:scale-110"
        aria-label="Close modal"
        tabIndex={isOpen ? 0 : -1}
      >
        <svg className="h-5 w-5 text-white/70 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex flex-col lg:flex-row">
        {/* 3D Preview - Canvas stays mounted, frameloop toggles based on isOpen */}
        <div
          className="relative h-[300px] w-full bg-black/40 sm:h-[350px] lg:h-[500px] lg:w-[60%]"
          style={{
            pointerEvents: isOpen ? "auto" : "none",
            touchAction: isOpen ? "auto" : "none",
          }}
        >
          <MintPaintingPreviewScene
            isOpen={isOpen}
            isLoading={isLoading}
            paintingRef={paintingRef}
            thumbnailUrl={paintingMetadata.thumbnailUrl}
          />
        </div>

        {/* Content Panel */}
        <div className="flex flex-col justify-between space-y-4 p-4 sm:space-y-6 sm:p-6 lg:w-[40%]">
          {/* Title and Price */}
          <div className="space-y-3 sm:space-y-4">
            <h2 className="text-xl font-bold text-white/90 sm:text-2xl">{collectionName}</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white/90 sm:text-3xl">{MINT_PRICE}</span>
              <span className="text-base text-white/60 sm:text-lg">SOL</span>
            </div>
            <p className="text-sm text-white/55">{mintStatusLabel}</p>
          </div>

          {/* Action Button */}
          {!connected ? (
            // Connect Wallet Button (always enabled)
            <button
              type="button"
              onClick={() => {
                void handleConnectWallet();
              }}
              disabled={isLoading}
              tabIndex={isOpen ? 0 : -1}
              className={`relative flex h-[52px] w-full transform-gpu touch-manipulation items-center justify-center overflow-hidden rounded-[26px] border p-0 shadow-[0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur-md transition-all duration-300 ease-in-out will-change-transform outline-none sm:h-[56px] sm:rounded-[28px] ${
                isLoading
                  ? "cursor-not-allowed border-white/25 bg-white/15 opacity-60 shadow-white/15"
                  : "cursor-pointer border-white/35 bg-white/25 opacity-100 shadow-white/20 active:scale-[0.97] active:bg-white/35 active:shadow-[0_8px_24px_rgba(255,255,255,0.35)] active:shadow-white/30 sm:hover:scale-[1.02] sm:hover:bg-white/30 sm:hover:shadow-[0_6px_20px_rgba(255,255,255,0.25)] sm:hover:shadow-white/25"
              } `}
            >
              <span className="relative z-10 text-sm font-bold tracking-[0.5px] text-white uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:text-base">
                {isLoading ? "Processing..." : "Connect Wallet"}
              </span>
            </button>
          ) : (
            // Mint Button
            <button
              type="button"
              onClick={() => {
                void handleMint();
              }}
              disabled={isLoading || isMintCompleted}
              tabIndex={isOpen ? 0 : -1}
              className={`relative flex h-[52px] w-full transform-gpu touch-manipulation items-center justify-center overflow-hidden rounded-[26px] border p-0 shadow-[0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur-md transition-all duration-300 ease-in-out will-change-transform outline-none sm:h-[56px] sm:rounded-[28px] ${
                isLoading || isMintCompleted
                  ? "cursor-not-allowed border-white/20 bg-white/10 opacity-40 shadow-white/10"
                  : "cursor-pointer border-white/35 bg-white/25 opacity-100 shadow-white/20 active:scale-[0.97] active:bg-white/35 active:shadow-[0_8px_24px_rgba(255,255,255,0.35)] active:shadow-white/30 sm:hover:scale-[1.02] sm:hover:bg-white/30 sm:hover:shadow-[0_6px_20px_rgba(255,255,255,0.25)] sm:hover:shadow-white/25"
              } `}
            >
              <span
                className={`relative z-10 text-sm font-bold tracking-[0.5px] uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:text-base ${
                  isLoading || isMintCompleted ? "text-white/50" : "text-white"
                }`}
              >
                {isMintCompleted ? "Minted!" : isMinting ? "Minting..." : isProcessing ? "Processing..." : "Mint"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const MintModal: FC<MintModalProps> = ({ isOpen, onClose, paintingMetadata }) => {
  return (
    <div
      data-testid="mint-modal-shell"
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 backdrop-blur-sm transition-all duration-500 ease-in-out sm:p-4 ${
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{ backgroundColor: isOpen ? "rgba(0, 0, 0, 0.6)" : "transparent" }}
      aria-hidden={!isOpen}
    >
      <MintModalBody isOpen={isOpen} onClose={onClose} paintingMetadata={paintingMetadata} />
    </div>
  );
};
