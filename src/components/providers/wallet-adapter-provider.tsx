"use client";

import { getSolanaConnectionConfig } from "@/constants/solana";
import type { SolanaNetwork } from "@/constants/solana";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { useMemo } from "react";
import type { FC, ReactNode } from "react";

// Default styles that can be overridden by your app
import "@/styles/wallet-adapter.css";

// Default styles that can be overridden by your app

interface Props {
  children?: ReactNode;
}

function getWalletAdapterNetwork(configuredNetwork: SolanaNetwork): WalletAdapterNetwork {
  switch (configuredNetwork) {
    case "mainnet": {
      return WalletAdapterNetwork.Mainnet;
    }
    case "devnet": {
      return WalletAdapterNetwork.Devnet;
    }
    case "testnet": {
      return WalletAdapterNetwork.Testnet;
    }
  }
}

export const WalletAdapterProvider: FC<Props> = ({ children }) => {
  const { endpoint, network } = useMemo(() => getSolanaConnectionConfig(), []);
  const walletAdapterNetwork = getWalletAdapterNetwork(network);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: walletAdapterNetwork })],
    [walletAdapterNetwork],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {/* Your app's components go here, nested within the context providers. */}
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
