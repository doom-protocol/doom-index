import { logger } from "@/utils/logger";
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

  const getWalletDebugState = useCallback(
    () => ({
      connected: wallet.connected,
      connecting: wallet.connecting,
      publicKey: wallet.publicKey?.toString() ?? null,
      walletName: wallet.wallet?.adapter.name ?? null,
    }),
    [wallet],
  );

  const connectWallet = useCallback(async (): Promise<WalletConnectionResult> => {
    // Clear previous error
    setConnectionError(null);

    // Check if wallet is selected
    if (!wallet.wallet) {
      const error: WalletConnectionError = {
        type: "wallet_not_selected",
        message: "No wallet selected",
      };
      logger.warn("wallet.connection.no_wallet_selected", getWalletDebugState());
      toast.error("Please select a wallet first");
      setConnectionError(error.type);
      return nt.err(error);
    }

    // Check if already connected
    if (wallet.connected) {
      logger.info("wallet.connection.already_connected", getWalletDebugState());
      return nt.ok(true);
    }

    logger.info("wallet.connection.starting", {
      ...getWalletDebugState(),
    });

    try {
      logger.debug("wallet.connection.adapter-connect.start", getWalletDebugState());
      await wallet.connect();
      logger.debug("wallet.connection.adapter-connect.success", getWalletDebugState());
      logger.info("wallet.connection.success", {
        ...getWalletDebugState(),
      });
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
        ...getWalletDebugState(),
        error: err.message,
        errorType,
      });

      setConnectionError(errorType);
      return nt.err(errorObj);
    }
  }, [getWalletDebugState, wallet]);

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

  return {
    publicKey: wallet.publicKey?.toString() ?? null,
    connected: wallet.connected,
    connecting: wallet.connecting,
    connectWallet,
    disconnectWallet,
    connectionError,
  };
}
