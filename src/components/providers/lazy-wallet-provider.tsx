"use client";

import type { FC, ReactNode } from "react";
import { UmiProvider } from "@/components/providers/umi-provider";
import { WalletAdapterProvider } from "@/components/providers/wallet-adapter-provider";

/**
 * Composes the Solana wallet and Umi providers for client components.
 */
export const LazyWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <WalletAdapterProvider>
      <UmiProvider>{children}</UmiProvider>
    </WalletAdapterProvider>
  );
};
