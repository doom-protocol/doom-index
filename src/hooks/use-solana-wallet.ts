/**
 * useSolanaWallet Hook
 *
 * Provides Solana wallet connection using @solana/wallet-adapter-react
 * and integrates with Metaplex Umi for NFT operations
 *
 * @see https://developers.metaplex.com/
 * @see https://github.com/metaplex-foundation/umi
 */

import { useUmi } from "@/components/providers/umi-provider";
import { getErrorMessage } from "@/utils/error";
import { logger } from "@/utils/logger";
import type { Transaction } from "@metaplex-foundation/umi";
import { useWallet } from "@solana/wallet-adapter-react";
import * as nt from "neverthrow";
import { useCallback, useState } from "react";
import { toast } from "sonner";

/**
 * Wallet connection error types
 */
export type WalletConnectionErrorType =
  | "wallet_not_selected"
  | "connection_failed"
  | "connection_cancelled"
  | "unknown_error";

/**
 * Wallet connection error
 */
export interface WalletConnectionError {
  type: WalletConnectionErrorType;
  message: string;
}

/**
 * Wallet connection result
 */
export type WalletConnectionResult = nt.Result<boolean, WalletConnectionError>;

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
  connectWallet: () => Promise<WalletConnectionResult>;
  disconnectWallet: () => Promise<void>;
  connectionError: WalletConnectionErrorType | null;
}

/**
 * Hook for Solana wallet connection using wallet adapter and Umi integration
 *
 * @returns Wallet connection functions and state
 */
export function useSolanaWallet(): UseSolanaWalletResult {
  const [connectionError, setConnectionError] = useState<WalletConnectionErrorType | null>(null);
  const wallet = useWallet();
  const umi = useUmi();

  const connectWallet = useCallback(async (): Promise<WalletConnectionResult> => {
    // Clear previous error
    setConnectionError(null);

    // Check if wallet is selected
    if (!wallet.wallet) {
      const error: WalletConnectionError = {
        type: "wallet_not_selected",
        message: "No wallet selected",
      };
      logger.warn("wallet.connection.no_wallet_selected");
      toast.error("Please select a wallet first");
      setConnectionError(error.type);
      return nt.err(error);
    }

    // Check if already connected
    if (wallet.connected) {
      logger.info("wallet.connection.already_connected");
      return nt.ok(true);
    }

    logger.info("wallet.connection.starting", { walletName: wallet.wallet.adapter.name });

    try {
      await wallet.connect();
      logger.info("wallet.connection.success", { walletName: wallet.wallet.adapter.name });
      toast.success("Wallet connected successfully");
      return nt.ok(true);
    } catch (error) {
      const err = error as Error;
      let errorType: WalletConnectionErrorType = "unknown_error";
      let message = "Unknown error occurred";

      // Handle specific error types
      if (err.name === "WalletConnectionError" && err.message.includes("cancelled")) {
        errorType = "connection_cancelled";
        message = "Wallet connection cancelled";
        toast.info(message);
      } else if (err.name === "WalletNotReadyError") {
        errorType = "wallet_not_selected";
        message = "Wallet is not ready. Please try again.";
        toast.error(message);
      } else {
        errorType = "connection_failed";
        message = "Failed to connect wallet. Please try again.";
        toast.error(message);
      }

      const errorObj: WalletConnectionError = {
        type: errorType,
        message,
      };

      logger.error("wallet.connection.failed", {
        error: err.message,
        errorType,
        walletName: wallet.wallet.adapter.name,
      });

      setConnectionError(errorType);
      return nt.err(errorObj);
    }
  }, [wallet]);

  const disconnectWallet = useCallback(async (): Promise<void> => {
    setConnectionError(null);

    try {
      await wallet.disconnect();
      logger.info("wallet.disconnection.success");
      toast.success("Wallet disconnected");
    } catch (disconnectError) {
      const error = disconnectError as Error;
      logger.error("wallet.disconnection.failed", { error: error.message });
      toast.error("Failed to disconnect wallet");
    }
  }, [wallet]);

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
        error: getErrorMessage(error),
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
    connectWallet,
    disconnectWallet,
    connectionError,
  };
}
