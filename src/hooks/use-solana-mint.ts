/**
 * useSolanaMint Hook
 *
 * Mints a DOOM INDEX NFT through the custom Anchor/MPL Core program defined by
 * `src/constants/idl/doom_nft_program.json`.
 */

import {
  buildDoomNftMintTransaction,
  fetchGlobalConfig,
  getDoomNftProgramErrorMessage,
  isRetryableReservationRaceError,
  validateGlobalConfigForMint,
} from "@/lib/anchor/doom-nft-program";
import { getErrorMessage } from "@/utils/error";
import { logger } from "@/utils/logger";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";

const MAX_MINT_ATTEMPTS = 2;

/**
 * Mint result
 */
export interface MintResult {
  assetAddress: string;
  signature: string;
  tokenId: bigint;
}

/**
 * useSolanaMint hook result
 */
export interface UseSolanaMintResult {
  mint: () => Promise<MintResult>;
  isMinting: boolean;
  error: Error | null;
  nextTokenId: bigint | null;
  refreshMintState: () => Promise<void>;
}

function toMintError(error: unknown): Error {
  const doomProgramMessage = getDoomNftProgramErrorMessage(error);

  if (doomProgramMessage) {
    return new Error(doomProgramMessage);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(getErrorMessage(error) || "Minting failed");
}

/**
 * Hook for minting NFTs using the custom Doom NFT program.
 *
 * @returns Mint functions and state
 */
export function useSolanaMint(): UseSolanaMintResult {
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nextTokenId, setNextTokenId] = useState<bigint | null>(null);
  const { connection } = useConnection();
  const wallet = useWallet();

  const refreshMintState = useCallback(async (): Promise<void> => {
    try {
      const { globalConfig } = await fetchGlobalConfig(connection);
      setNextTokenId(globalConfig.nextTokenId);
    } catch (refreshError) {
      logger.warn("solana.mint.state-refresh-failed", {
        error: getErrorMessage(refreshError),
      });
      setNextTokenId(null);
    }
  }, [connection]);

  useEffect(() => {
    void refreshMintState();
  }, [refreshMintState]);

  const mint = useCallback(async (): Promise<MintResult> => {
    if (!wallet.connected || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    setIsMinting(true);
    setError(null);

    try {
      for (let attempt = 0; attempt < MAX_MINT_ATTEMPTS; attempt++) {
        const { address: globalConfigAddress, globalConfig } = await fetchGlobalConfig(connection);
        validateGlobalConfigForMint(globalConfig, globalConfigAddress);

        const tokenId = globalConfig.nextTokenId;
        const assetSigner = Keypair.generate();
        const transaction = buildDoomNftMintTransaction({
          asset: assetSigner.publicKey,
          collection: globalConfig.collection,
          globalConfig: globalConfigAddress,
          tokenId,
          user: wallet.publicKey,
        });
        const latestBlockhash = await connection.getLatestBlockhash();

        transaction.feePayer = wallet.publicKey;
        transaction.recentBlockhash = latestBlockhash.blockhash;

        logger.info("solana.mint.start", {
          attempt: attempt + 1,
          tokenId: tokenId.toString(),
          walletAddress: wallet.publicKey.toBase58(),
        });

        try {
          const signature = await wallet.sendTransaction(transaction, connection, {
            signers: [assetSigner],
          });
          const confirmation = await connection.confirmTransaction(
            {
              blockhash: latestBlockhash.blockhash,
              lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
              signature,
            },
            "confirmed",
          );

          if (confirmation.value.err) {
            throw new Error(`Mint transaction failed: ${JSON.stringify(confirmation.value.err)}`);
          }

          logger.info("solana.mint.success", {
            assetAddress: assetSigner.publicKey.toBase58(),
            signature,
            tokenId: tokenId.toString(),
          });

          setNextTokenId(tokenId + BigInt(1));

          return {
            assetAddress: assetSigner.publicKey.toBase58(),
            signature,
            tokenId,
          };
        } catch (mintAttemptError) {
          if (attempt + 1 < MAX_MINT_ATTEMPTS && isRetryableReservationRaceError(mintAttemptError)) {
            logger.warn("solana.mint.retrying-after-race", {
              attempt: attempt + 1,
              error: getErrorMessage(mintAttemptError),
            });
            continue;
          }

          throw mintAttemptError;
        }
      }

      throw new Error("Minting failed after retry.");
    } catch (mintError) {
      const resolvedError = toMintError(mintError);

      logger.error("solana.mint.failed", {
        error: resolvedError.message,
        details: mintError,
      });

      setError(resolvedError);
      throw resolvedError;
    } finally {
      setIsMinting(false);
    }
  }, [connection, wallet]);

  return {
    error,
    isMinting,
    mint,
    nextTokenId,
    refreshMintState,
  };
}
