"use client";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { useWallet } from "@solana/wallet-adapter-react";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Umi } from "@metaplex-foundation/umi";
import { env } from "@/env";

// Create Umi instance
const createUmiInstance = (): Umi => {
  // Fallback to devnet if RPC URL is not set
  const rpcUrl = env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
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

    const umiInstance = createUmiInstance();

    // If wallet is connected, use wallet adapter identity
    if (wallet.publicKey && wallet.signTransaction) {
      umiInstance.use(walletAdapterIdentity(wallet as unknown as Parameters<typeof walletAdapterIdentity>[0]));
    }

    return umiInstance;
  }, [wallet]);

  return <UmiContext.Provider value={umi}>{children}</UmiContext.Provider>;
};
