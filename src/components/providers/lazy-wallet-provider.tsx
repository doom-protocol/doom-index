"use client";

import { Buffer } from "node:buffer";
import type { FC, ReactNode } from "react";
import { WalletAdapterProvider } from "@/components/providers/wallet-adapter-provider";

if (typeof globalThis.Buffer !== "function") {
  Object.defineProperty(globalThis, "Buffer", {
    value: Buffer,
    configurable: true,
    writable: true,
  });
}

/**
 * Composes the Solana wallet providers for the mint feature subtree.
 */
export const LazyWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return <WalletAdapterProvider>{children}</WalletAdapterProvider>;
};
