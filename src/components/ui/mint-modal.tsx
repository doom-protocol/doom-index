"use client";

/**
 * Mint Modal Component
 *
 * Handles the complete NFT minting flow:
 * 1. Export GLB from FramedPainting
 * 2. Upload GLB and metadata to IPFS via Pinata
 * 3. Connect Solana wallet
 * 4. Mint NFT using Metaplex Token Metadata
 * 5. Display success/error states
 */

import { FC, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useIpfsUpload } from "@/hooks/use-ipfs-upload";
import { useSolanaWallet } from "@/hooks/use-solana-wallet";
import { useSolanaMint } from "@/hooks/use-solana-mint";
import { logger } from "@/utils/logger";
import { GA_EVENTS, sendGAEvent } from "@/lib/analytics";

/**
 * Mint modal props
 */
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

/**
 * Mint flow steps
 */
type MintStep = "upload" | "connect" | "mint" | "success" | "error";

/**
 * Mint Modal Component
 */
export const MintModal: FC<MintModalProps> = ({ isOpen, onClose, paintingMetadata, glbFile }) => {
  const [step, setStep] = useState<MintStep>("upload");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mintResult, setMintResult] = useState<{ signature: string; mintAddress: string } | null>(null);

  const { uploadGlbAndMetadata, isUploading, progress, error: uploadError } = useIpfsUpload();
  const { publicKey, connected } = useSolanaWallet();
  const { mint, isMinting } = useSolanaMint();
  const wallet = useWallet();

  const [ipfsData, setIpfsData] = useState<{ cidGlb: string; cidMetadata: string } | null>(null);

  // Handle IPFS upload
  const handleUpload = useCallback(async () => {
    if (!glbFile) {
      setErrorMessage("No GLB file provided");
      setStep("error");
      return;
    }

    try {
      setStep("upload");
      sendGAEvent(GA_EVENTS.MINT_UPLOAD_START);

      const result = await uploadGlbAndMetadata(glbFile, {
        paintingHash: paintingMetadata.paintingHash,
        timestamp: paintingMetadata.timestamp,
        walletAddress: publicKey ?? undefined,
      });

      setIpfsData(result);
      setStep("connect");

      logger.info("mint.upload.success", {
        cidGlb: result.cidGlb,
        cidMetadata: result.cidMetadata,
      });
    } catch (error) {
      logger.error("mint.upload.failed", { error });
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
      setStep("error");
    }
  }, [glbFile, uploadGlbAndMetadata, paintingMetadata, publicKey]);

  // Handle wallet connection
  const handleConnect = useCallback(async () => {
    try {
      sendGAEvent(GA_EVENTS.MINT_WALLET_CONNECT);
      await wallet.connect();
      setStep("mint");
    } catch (error) {
      logger.error("mint.connect.failed", { error });
      setErrorMessage(error instanceof Error ? error.message : "Wallet connection failed");
      setStep("error");
    }
  }, [wallet]);

  // Handle NFT minting
  const handleMint = useCallback(async () => {
    if (!ipfsData) {
      setErrorMessage("Missing required data for minting");
      setStep("error");
      return;
    }

    try {
      sendGAEvent(GA_EVENTS.MINT_TRANSACTION_START);

      const result = await mint({
        name: `DOOM INDEX #${paintingMetadata.paintingHash.slice(0, 8)}`,
        symbol: "DOOM",
        uri: `ipfs://${ipfsData.cidMetadata}`,
        sellerFeeBasisPoints: 0,
      });

      setMintResult(result);
      setStep("success");

      logger.info("mint.success", {
        signature: result.signature,
        mintAddress: result.mintAddress,
      });

      sendGAEvent(GA_EVENTS.MINT_SUCCESS);
    } catch (error) {
      logger.error("mint.failed", { error });
      setErrorMessage(error instanceof Error ? error.message : "Minting failed");
      setStep("error");
    }
  }, [ipfsData, mint, paintingMetadata]);

  // Handle modal close
  const handleClose = useCallback(() => {
    setStep("upload");
    setErrorMessage(null);
    setMintResult(null);
    setIpfsData(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-black/80 border border-white/20 rounded-2xl shadow-2xl p-6">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal content */}
        <div className="space-y-6">
          {/* Title */}
          <h2 className="text-2xl font-bold text-white">Mint NFT</h2>

          {/* Step: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-white/70">Upload your artwork to IPFS</p>
              {isUploading && (
                <div className="space-y-2">
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-white/60 text-center">{progress}%</p>
                </div>
              )}
              {uploadError && <p className="text-red-400 text-sm">{uploadError.message}</p>}
              <button
                onClick={handleUpload}
                disabled={isUploading || !glbFile}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isUploading ? "Uploading..." : "Upload to IPFS"}
              </button>
            </div>
          )}

          {/* Step: Connect Wallet */}
          {step === "connect" && (
            <div className="space-y-4">
              <p className="text-white/70">Connect your Solana wallet to mint</p>
              {connected && publicKey && (
                <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                  <p className="text-sm text-green-200">
                    Connected: {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
                  </p>
                </div>
              )}
              <button
                onClick={connected ? handleMint : handleConnect}
                disabled={wallet.connecting}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {wallet.connecting ? "Connecting..." : connected ? "Continue to Mint" : "Connect Wallet"}
              </button>
            </div>
          )}

          {/* Step: Mint */}
          {step === "mint" && (
            <div className="space-y-4">
              <p className="text-white/70">Mint your NFT on Solana</p>
              {isMinting && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                </div>
              )}
              <button
                onClick={handleMint}
                disabled={isMinting}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isMinting ? "Minting..." : "Mint NFT"}
              </button>
            </div>
          )}

          {/* Step: Success */}
          {step === "success" && mintResult && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">NFT Minted Successfully!</h3>
                <p className="text-white/60 text-sm mb-4">Your artwork is now on the Solana blockchain</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg space-y-2">
                <div>
                  <p className="text-xs text-white/40">Mint Address</p>
                  <p className="text-sm text-white/80 font-mono break-all">{mintResult.mintAddress}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Transaction</p>
                  <a
                    href={`https://explorer.solana.com/tx/${mintResult.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 font-mono break-all"
                  >
                    {mintResult.signature.slice(0, 8)}...{mintResult.signature.slice(-8)}
                  </a>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* Step: Error */}
          {step === "error" && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Minting Failed</h3>
                <p className="text-red-400 text-sm">{errorMessage}</p>
              </div>
              <button
                onClick={() => setStep("upload")}
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
