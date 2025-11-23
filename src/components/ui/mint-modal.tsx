"use client";

/**
 * Mint Modal Component
 *
 * Simple, conversion-focused minting UI with 3D preview, price, and mint button
 */

import { FC, useState, useCallback, useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, PCFSoftShadowMap, Group } from "three";
import { OrbitControls } from "@react-three/drei";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useSolanaWallet } from "@/hooks/use-solana-wallet";
import { useSolanaMint } from "@/hooks/use-solana-mint";
import { useIpfsUpload } from "@/hooks/use-ipfs-upload";
import { logger } from "@/utils/logger";
import { getErrorMessage } from "@/utils/error";
import { GA_EVENTS, sendGAEvent } from "@/lib/analytics";
import { FramedPainting } from "@/components/gallery/framed-painting";
import { Lights } from "@/components/gallery/lights";
import { toast } from "sonner";

export interface MintModalProps {
  isOpen: boolean;
  onClose: () => void;
  paintingMetadata: {
    timestamp: string;
    paintingHash: string;
    thumbnailUrl: string;
  };
  glbFile: File | null;
}

export const MintModal: FC<MintModalProps> = ({ isOpen, onClose, paintingMetadata, glbFile }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMintCompleted, setIsMintCompleted] = useState(false);
  const [uploadedMetadata, setUploadedMetadata] = useState<{
    cidGlb: string;
    cidMetadata: string;
  } | null>(null);
  const paintingRef = useRef<Group>(null);

  const { connected, connecting: isWalletConnecting, publicKey } = useSolanaWallet();
  const { setVisible } = useWalletModal();
  const { mint, isMinting } = useSolanaMint();
  const { uploadGlbAndMetadata, isUploading: isIpfsUploading } = useIpfsUpload();

  // Mock price (in SOL)
  const MINT_PRICE = 0.1;

  // Handle wallet connection
  const handleConnectWallet = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  // Handle complete mint flow
  const handleMint = useCallback(async () => {
    // Step 1: Check wallet connection
    if (!connected) {
      setVisible(true);
      return;
    }

    // Step 2: Validate required data
    if (!glbFile) {
      toast.error("Artwork is still being prepared. Please wait...");
      return;
    }

    setIsProcessing(true);

    try {
      // Step 3: Mint NFT first, then upload to IPFS after transaction is sent
      let metadata = uploadedMetadata;

      // Mint NFT first (signature prompt shows immediately)
      sendGAEvent(GA_EVENTS.MINT_TRANSACTION_START);

      // Use placeholder URI for minting if metadata doesn't exist yet
      const tokenId = parseInt(paintingMetadata.paintingHash.slice(0, 8), 16);
      const mintUri = metadata ? `ipfs://${metadata.cidMetadata}` : `ipfs://${tokenId}/metadata.json`; // Placeholder

      const result = await mint({
        name: `DOOM INDEX #${tokenId}`,
        symbol: "DOOM",
        uri: mintUri,
        sellerFeeBasisPoints: 0,
      });

      logger.info("mint.success", {
        signature: result.signature,
        mintAddress: result.mintAddress,
      });

      // Now upload to IPFS after transaction is sent
      if (!metadata) {
        logger.info("mint-modal.ipfs-upload.start");
        toast.info("Uploading artwork to IPFS...");

        const ipfsResult = await uploadGlbAndMetadata(glbFile, {
          paintingHash: paintingMetadata.paintingHash,
          timestamp: paintingMetadata.timestamp,
          walletAddress: publicKey ?? undefined,
        });

        metadata = {
          cidGlb: ipfsResult.cidGlb,
          cidMetadata: ipfsResult.cidMetadata,
        };
        setUploadedMetadata(metadata);
        logger.info("mint-modal.ipfs-upload.success", {
          cidGlb: ipfsResult.cidGlb,
          cidMetadata: ipfsResult.cidMetadata,
        });
      }

      setIsMintCompleted(true);
      sendGAEvent(GA_EVENTS.MINT_SUCCESS);
      toast.success("NFT minted successfully!");

      // Close modal after successful mint
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
  }, [
    glbFile,
    uploadedMetadata,
    paintingMetadata,
    connected,
    setVisible,
    mint,
    onClose,
    uploadGlbAndMetadata,
    publicKey,
  ]);

  // Handle modal close
  const handleClose = useCallback(() => {
    setIsProcessing(false);
    onClose();
  }, [onClose]);

  const isLoading = isMinting || isWalletConnecting || isProcessing || isIpfsUploading;

  // Extract token ID from painting hash (first 8 characters as int)
  const tokenId = parseInt(paintingMetadata.paintingHash.slice(0, 8), 16);
  const collectionName = `DOOM NFT #${tokenId}`;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm overflow-y-auto transition-all duration-500 ease-in-out ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      style={{ backgroundColor: isOpen ? "rgba(0, 0, 0, 0.6)" : "transparent" }}
      aria-hidden={!isOpen}
    >
      <div
        className={`relative w-full max-w-2xl my-auto bg-black/80 border border-white/15 rounded-[16px] sm:rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md overflow-hidden liquid-glass-effect transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) ${
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"
        }`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all hover:bg-white/20 active:scale-95 sm:hover:scale-110 cursor-pointer touch-manipulation"
          aria-label="Close modal"
          tabIndex={isOpen ? 0 : -1}
        >
          <svg className="h-5 w-5 sm:h-4 sm:w-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col lg:flex-row">
          {/* 3D Preview */}
          <div className="relative h-[300px] sm:h-[350px] lg:h-[500px] w-full lg:w-[60%] bg-black/40">
            <Canvas
              frameloop={isOpen ? "always" : "never"}
              shadows
              dpr={[1, 1.5]}
              camera={{
                fov: 50,
                position: [0, 0.8, 0.8],
                near: 0.1,
                far: 100,
              }}
              gl={{
                antialias: true,
                toneMapping: ACESFilmicToneMapping,
              }}
              onCreated={({ gl }) => {
                gl.shadowMap.enabled = true;
                gl.shadowMap.type = PCFSoftShadowMap;
                gl.toneMapping = ACESFilmicToneMapping;
                gl.setClearColor("#050505");
              }}
              style={{ width: "100%", height: "100%" }}
            >
              <Lights />
              <OrbitControls
                enableDamping
                dampingFactor={0.05}
                minDistance={2}
                maxDistance={6}
                target={[0, 0.8, 4.0]}
                rotateSpeed={0.5}
                zoomSpeed={0.5}
                enabled={!isLoading && isOpen}
              />
              <Suspense fallback={null}>
                <FramedPainting ref={paintingRef} thumbnailUrl={paintingMetadata.thumbnailUrl} />
              </Suspense>
            </Canvas>
          </div>

          {/* Content Panel */}
          <div className="flex flex-col justify-between p-4 sm:p-6 lg:w-[40%] space-y-4 sm:space-y-6">
            {/* Title and Price */}
            <div className="space-y-3 sm:space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white/90">{collectionName}</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-white/90">{MINT_PRICE}</span>
                <span className="text-base sm:text-lg text-white/60">SOL</span>
              </div>
            </div>

            {/* Action Button */}
            {!connected ? (
              // Connect Wallet Button (always enabled)
              <button
                onClick={handleConnectWallet}
                disabled={isLoading}
                tabIndex={isOpen ? 0 : -1}
                className={`
                  relative w-full h-[52px] sm:h-[56px] rounded-[26px] sm:rounded-[28px] border
                  backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.2)]
                  flex items-center justify-center transition-all duration-300 ease-in-out
                  touch-manipulation p-0 outline-none overflow-hidden
                  transform-gpu will-change-transform
                  ${
                    isLoading
                      ? "bg-white/15 border-white/25 cursor-not-allowed opacity-60 shadow-white/15"
                      : "bg-white/25 border-white/35 cursor-pointer opacity-100 active:scale-[0.97] sm:hover:bg-white/30 sm:hover:scale-[1.02] sm:hover:shadow-[0_6px_20px_rgba(255,255,255,0.25)] sm:hover:shadow-white/25 active:bg-white/35 active:shadow-[0_8px_24px_rgba(255,255,255,0.35)] active:shadow-white/30 shadow-white/20"
                  }
                `}
              >
                <span className="relative z-10 text-sm sm:text-base font-bold tracking-[0.5px] uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] text-white">
                  {isLoading ? "Processing..." : "Connect Wallet"}
                </span>
              </button>
            ) : (
              // Mint Button
              <button
                onClick={handleMint}
                disabled={isLoading || !glbFile || !isMintCompleted}
                tabIndex={isOpen ? 0 : -1}
                className={`
                  relative w-full h-[52px] sm:h-[56px] rounded-[26px] sm:rounded-[28px] border
                  backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.2)]
                  flex items-center justify-center transition-all duration-300 ease-in-out
                  touch-manipulation p-0 outline-none overflow-hidden
                  transform-gpu will-change-transform
                  ${
                    isLoading || !glbFile || !isMintCompleted
                      ? "bg-white/10 border-white/20 cursor-not-allowed opacity-40 shadow-white/10"
                      : "bg-white/25 border-white/35 cursor-pointer opacity-100 active:scale-[0.97] sm:hover:bg-white/30 sm:hover:scale-[1.02] sm:hover:shadow-[0_6px_20px_rgba(255,255,255,0.25)] sm:hover:shadow-white/25 active:bg-white/35 active:shadow-[0_8px_24px_rgba(255,255,255,0.35)] active:shadow-white/30 shadow-white/20"
                  }
                `}
              >
                <span
                  className={`relative z-10 text-sm sm:text-base font-bold tracking-[0.5px] uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] ${
                    isLoading || !glbFile || !isMintCompleted ? "text-white/50" : "text-white"
                  }`}
                >
                  {isMintCompleted
                    ? "Minted!"
                    : isIpfsUploading
                      ? "Uploading..."
                      : isMinting
                        ? "Minting..."
                        : isProcessing
                          ? "Processing..."
                          : "Coming Soon"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
