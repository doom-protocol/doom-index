"use client";

import { FC, useEffect, useState } from "react";
import { GA_EVENTS, sendGAEvent } from "@/lib/analytics";
import { useHaptic } from "use-haptic";

interface MintButtonProps {
  disabled?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onClick?: () => void;
}

export const MintButton: FC<MintButtonProps> = ({
  disabled = false,
  isLoading = false,
  isError: initialIsError = false,
  onClick,
}) => {
  const { triggerHaptic } = useHaptic();
  const [showError, setShowError] = useState(initialIsError);

  useEffect(() => {
    if (initialIsError) {
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [initialIsError]);

  const handleClick = () => {
    triggerHaptic();
    if (!disabled && !isLoading && !showError) {
      sendGAEvent(GA_EVENTS.MINT_BUTTON_CLICK);

      // If GLB file is already exported, trigger onClick to open modal (handled by parent)
      // Otherwise, trigger export
      if (onClick) {
        onClick();
      }
    }
  };

  const isInteractive = !disabled && !isLoading;
  const isErrorState = showError;

  return (
    <button
      type="button"
      disabled={disabled || isLoading || isErrorState}
      aria-disabled={disabled || isLoading || isErrorState}
      className={`
        relative w-[120px] h-[36px] rounded-[18px] border
        backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.2)]
        flex items-center justify-center transition-all duration-300 ease-in-out
        touch-manipulation p-0 outline-none pointer-events-auto overflow-hidden
        transform-gpu will-change-transform
        ${
          isErrorState
            ? "bg-red-500/20 border-red-500/50 shadow-red-500/20 cursor-not-allowed"
            : !isInteractive
              ? "bg-white/5 border-white/15 cursor-not-allowed opacity-60 active:animate-shake liquid-glass-effect shadow-white/5"
              : "bg-white/8 border-white/15 cursor-pointer opacity-100 hover:bg-white/12 hover:scale-105 hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)] hover:shadow-white/10 active:scale-90 active:bg-white/20 active:shadow-[0_8px_24px_rgba(0,0,0,0.4)] active:shadow-white/15 liquid-glass-effect shadow-white/5"
        }
      `}
      onClick={handleClick}
    >
      <span
        className={`
        relative z-10 text-xs font-medium tracking-[0.5px] uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]
        ${isErrorState ? "text-red-200" : "text-white/70"}
      `}
      >
        Mint
      </span>
    </button>
  );
};
