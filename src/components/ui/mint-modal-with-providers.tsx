"use client";

import { LazyWalletProvider } from "@/components/providers/lazy-wallet-provider";
import { MintModal } from "@/components/ui/mint-modal";
import type { MintModalProps } from "@/components/ui/mint-modal";
import type { FC } from "react";

export const MintModalWithProviders: FC<MintModalProps> = (props) => {
  return (
    <LazyWalletProvider>
      <MintModal {...props} />
    </LazyWalletProvider>
  );
};
