"use client";

import { getSolanaConnectionConfig } from "@/constants/solana";
import type { SolanaNetwork } from "@/constants/solana";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  CoinbaseWalletAdapter,
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
} from "@solana/wallet-adapter-wallets";
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
    () => [
      /**
       * Wallets that implement either of these standards will be available automatically.
       *
       *   - Solana Mobile Stack Mobile Wallet Adapter Protocol
       *     (https://github.com/solana-mobile/mobile-wallet-adapter)
       *   - Solana Wallet Standard
       *     (https://github.com/anza-xyz/wallet-standard)
       *
       * If you wish to support a wallet that supports neither of those standards,
       * instantiate its legacy wallet adapter here. Common legacy adapters can be found
       * in the npm package `@solana/wallet-adapter-wallets`.
       */
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: walletAdapterNetwork }),
      new CoinbaseWalletAdapter(),
      new TrustWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
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
