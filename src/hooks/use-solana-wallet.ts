/**
 * useSolanaWallet Hook
 *
 * Provides Solana wallet connection using @solana/wallet-adapter-react
 * and integrates with Metaplex Umi for NFT operations
 *
 * @see https://developers.metaplex.com/
 * @see https://github.com/metaplex-foundation/umi
 */

import { useWallet } from "@solana/wallet-adapter-react";
import { useUmi } from "@/components/providers/umi-provider";
import type { Transaction } from "@metaplex-foundation/umi";
import { logger } from "@/utils/logger";

/**
 * Wallet connection state
 */
export interface WalletState {
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
}

/**
 * useSolanaWallet hook result
 */
export interface UseSolanaWalletResult extends WalletState {
  umi: ReturnType<typeof useUmi>;
  signAndSendTransaction: (transaction: Transaction) => Promise<string>;
}

/**
 * Hook for Solana wallet connection using wallet adapter and Umi integration
 *
 * @returns Wallet connection functions and state
 */
export function useSolanaWallet(): UseSolanaWalletResult {
  const wallet = useWallet();
  const umi = useUmi();

  const signAndSendTransaction = async (transaction: Transaction): Promise<string> => {
    if (!wallet.connected) {
      throw new Error("Wallet not connected");
    }

    try {
      logger.info("solana.transaction.signing");

      // Send and confirm transaction using Umi
      const result = await umi.rpc.sendTransaction(transaction);
      const signature = result.toString();

      logger.info("solana.transaction.sent", { signature });

      return signature;
    } catch (error) {
      logger.error("solana.transaction.failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  return {
    umi,
    publicKey: wallet.publicKey?.toString() ?? null,
    connected: wallet.connected,
    connecting: wallet.connecting,
    signAndSendTransaction,
  };
}
