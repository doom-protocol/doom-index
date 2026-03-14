"use client";

import type { FC, ReactNode } from "react";
import { WalletAdapterProvider } from "@/components/providers/wallet-adapter-provider";

/**
 * Composes the Solana wallet providers for the mint feature subtree.
 */
export const LazyWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return <WalletAdapterProvider>{children}</WalletAdapterProvider>;
};
