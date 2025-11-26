"use client";

import { getSolanaRpcUrl } from "@/constants/solana";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import type { Umi } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { useWallet } from "@solana/wallet-adapter-react";
import { createContext, useContext, useMemo, type ReactNode } from "react";

// Create Umi instance
const createUmiInstance = (): Umi => {
  // Get RPC URL using centralized configuration
  const rpcUrl = getSolanaRpcUrl();

  const umi = createUmi(rpcUrl).use(mplTokenMetadata());

  return umi;
};

// Create context
const UmiContext = createContext<Umi | null>(null);

// Hook to use Umi
export const useUmi = (): Umi => {
  const umi = useContext(UmiContext);
  if (!umi) {
    throw new Error("useUmi must be used within a UmiProvider");
  }
  return umi;
};

interface UmiProviderProps {
  children: ReactNode;
}

export const UmiProvider: React.FC<UmiProviderProps> = ({ children }) => {
  const wallet = useWallet();

  const umi = useMemo(() => {
    // Only create Umi instance on client side (prevent SSR issues)
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const umiInstance = createUmiInstance();

      // If wallet is connected, use wallet adapter identity
      if (wallet.publicKey && wallet.signTransaction) {
        umiInstance.use(walletAdapterIdentity(wallet as unknown as Parameters<typeof walletAdapterIdentity>[0]));
      }

      return umiInstance;
    } catch (error) {
      console.error("Failed to initialize Umi:", error);
      // Return null to prevent app crash, but this should be handled by useUmi hook
      return null;
    }
  }, [wallet]);

  return <UmiContext.Provider value={umi}>{children}</UmiContext.Provider>;
};
