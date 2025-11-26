"use client";

import { useClickOutside } from "@/hooks/use-click-outside";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { type FC, useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export const WalletButton: FC = () => {
  const { publicKey, wallet, disconnect, connecting, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Close dropdown when clicking outside
  useClickOutside(dropdownRef, () => setIsDropdownOpen(false));

  const handleConnect = useCallback(() => {
    if (!connected && !connecting) {
      setVisible(true);
    }
  }, [connected, connecting, setVisible]);

  const handleDisconnect = useCallback(() => {
    disconnect().catch(() => {
      // Silent error
    });
    setIsDropdownOpen(false);
    toast.success("Wallet disconnected");
  }, [disconnect]);

  const copyAddress = useCallback(() => {
    if (publicKey) {
      void navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      toast.success("Address copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
      setIsDropdownOpen(false);
    }
  }, [publicKey]);

  const base58 = publicKey?.toBase58();
  const content =
    connected && wallet
      ? `${base58?.slice(0, 4)}...${base58?.slice(-4)}`
      : connecting
        ? "Connecting..."
        : "Connect Wallet";

  if (!connected) {
    return (
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        className="liquid-glass-effect relative flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 backdrop-blur-md transition-all duration-300 hover:border-white/40 hover:bg-white/10 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="liquid-glass-effect relative flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md transition-all duration-300 hover:border-white/50 hover:bg-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.15)] active:scale-95"
      >
        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
        {content}
      </button>

      {isDropdownOpen && (
        <div className="animate-in fade-in zoom-in-95 absolute top-full right-0 mt-2 w-48 overflow-hidden rounded-xl border border-white/20 bg-black/80 p-1 shadow-xl backdrop-blur-xl transition-all duration-200">
          <button
            onClick={copyAddress}
            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {copied ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              )}
            </svg>
            Copy Address
          </button>
          <button
            onClick={handleDisconnect}
            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-white/10 hover:text-red-300"
          >
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};
