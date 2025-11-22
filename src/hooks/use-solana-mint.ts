/**
 * useSolanaMint Hook
 *
 * Provides NFT minting functionality using Metaplex Token Metadata
 * Handles transaction building and minting to Solana
 *
 * @see https://developers.metaplex.com/token-metadata
 */

import { useState, useCallback } from "react";
import { generateSigner, percentAmount } from "@metaplex-foundation/umi";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { useUmi } from "@/components/providers/umi-provider";
import { useWallet } from "@solana/wallet-adapter-react";
import { logger } from "@/utils/logger";

/**
 * Mint parameters
 */
export interface MintParams {
  name: string;
  symbol: string;
  uri: string; // IPFS metadata URI
  sellerFeeBasisPoints?: number;
}

/**
 * Mint result
 */
export interface MintResult {
  signature: string;
  mintAddress: string;
}

/**
 * useSolanaMint hook result
 */
export interface UseSolanaMintResult {
  mint: (params: MintParams) => Promise<MintResult>;
  isMinting: boolean;
  error: Error | null;
}

/**
 * Hook for minting NFTs using Metaplex Token Metadata
 *
 * @returns Mint functions and state
 */
export function useSolanaMint(): UseSolanaMintResult {
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const umi = useUmi();
  const wallet = useWallet();

  const mint = useCallback(
    async (params: MintParams): Promise<MintResult> => {
      if (!wallet.connected) {
        throw new Error("Wallet not connected");
      }
      setIsMinting(true);
      setError(null);

      try {
        logger.info("solana.mint.start", { name: params.name, uri: params.uri });

        // Generate a new mint address
        const mint = generateSigner(umi);

        logger.info("solana.mint.address-generated", { mintAddress: mint.publicKey });

        // Create NFT using Metaplex Token Metadata
        const tx = await createNft(umi, {
          mint,
          name: params.name,
          symbol: params.symbol,
          uri: params.uri,
          sellerFeeBasisPoints: percentAmount(params.sellerFeeBasisPoints ?? 0),
          isCollection: false,
        });

        // Send and confirm transaction
        const result = await tx.sendAndConfirm(umi);
        const signature = result.signature.toString();

        logger.info("solana.mint.success", {
          signature,
          mintAddress: mint.publicKey,
        });

        setIsMinting(false);

        return {
          signature,
          mintAddress: mint.publicKey.toString(),
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error("solana.mint.failed", {
          error: error.message,
          details: err,
        });

        setError(error);
        setIsMinting(false);

        throw error;
      }
    },
    [umi, wallet.connected],
  );

  return {
    mint,
    isMinting,
    error,
  };
}
