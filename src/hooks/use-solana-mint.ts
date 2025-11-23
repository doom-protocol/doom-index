/**
 * useSolanaMint Hook
 *
 * Provides NFT minting functionality using Metaplex Token Metadata
 * Handles transaction building and minting to Solana
 *
 * @see https://developers.metaplex.com/token-metadata
 */

import { useState, useCallback } from "react";
import { generateSigner, percentAmount, publicKey } from "@metaplex-foundation/umi";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { useUmi } from "@/components/providers/umi-provider";
import { useWallet } from "@solana/wallet-adapter-react";
import { logger } from "@/utils/logger";
import {
  DOOM_INDEX_COLLECTION_ADDRESS,
  UPDATE_AUTHORITY_ADDRESS,
  DEFAULT_SELLER_FEE_BASIS_POINTS,
  CREATORS,
} from "@/constants/solana";

type CreateNftInput = Parameters<typeof createNft>[1];

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
        const nftConfig: CreateNftInput = {
          mint,
          name: params.name,
          symbol: params.symbol,
          uri: params.uri,
          sellerFeeBasisPoints: percentAmount(params.sellerFeeBasisPoints ?? DEFAULT_SELLER_FEE_BASIS_POINTS),
          isCollection: false,
        };

        // Optional: Add collection if configured
        if (DOOM_INDEX_COLLECTION_ADDRESS) {
          nftConfig.collection = {
            verified: false,
            key: DOOM_INDEX_COLLECTION_ADDRESS,
          };
        }

        // Optional: Add update authority if configured
        if (UPDATE_AUTHORITY_ADDRESS) {
          nftConfig.updateAuthority = UPDATE_AUTHORITY_ADDRESS;
        }

        // Optional: Add creators if configured and valid
        if (CREATORS.length > 0 && CREATORS[0].address) {
          nftConfig.creators = CREATORS.map(creator => ({
            address: publicKey(creator.address),
            verified: creator.verified,
            share: creator.share,
          }));
        }

        const tx = await createNft(umi, nftConfig);

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
