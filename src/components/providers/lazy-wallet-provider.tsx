"use client";

import { useEffect, useState } from "react";
import type { FC, ReactNode } from "react";
import dynamic from "next/dynamic";

const WalletAdapterProvider = dynamic(
  async () =>
    import("@/components/providers/wallet-adapter-provider").then((mod) => ({
      default: mod.WalletAdapterProvider,
    })),
  { ssr: false },
);

const UmiProvider = dynamic(
  async () =>
    import("@/components/providers/umi-provider").then((mod) => ({
      default: mod.UmiProvider,
    })),
  { ssr: false },
);

/**
 * Defers wallet/Umi provider mounting until after initial render.
 * This keeps Solana dependencies out of the critical rendering path.
 */
export const LazyWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => {
        setReady(true);
      });
      return () => {
        window.cancelIdleCallback(id);
      };
    }
    // Fallback: defer to next frame
    const id = window.setTimeout(() => {
      setReady(true);
    }, 0);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  if (!ready) {
    return <>{children}</>;
  }

  return (
    <WalletAdapterProvider>
      <UmiProvider>{children}</UmiProvider>
    </WalletAdapterProvider>
  );
};
