"use client";

import { FC } from "react";
import { GA_EVENTS, sendGAEvent } from "@/lib/analytics";
import { useHaptic } from "use-haptic";

interface MintButtonProps {
  disabled?: boolean;
}

export const MintButton: FC<MintButtonProps> = ({ disabled = false }) => {
  const { triggerHaptic } = useHaptic();

  const onClick = () => {
    triggerHaptic();
    if (!disabled) {
      sendGAEvent(GA_EVENTS.MINT_BUTTON_CLICK);
    }
  };

  return (
    <button
      type="button"
      aria-disabled={disabled}
      className={`
        relative w-[120px] h-[36px] rounded-[18px] border border-white/15
        backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.2)] shadow-white/5
        flex items-center justify-center transition-all duration-300 ease-in-out
        touch-manipulation p-0 outline-none pointer-events-auto overflow-hidden
        transform-gpu will-change-transform
        ${
          disabled
            ? "bg-white/5 cursor-not-allowed opacity-60 active:animate-shake liquid-glass-effect"
            : "bg-white/8 cursor-pointer opacity-100 hover:bg-white/12 hover:scale-105 hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)] hover:shadow-white/10 active:scale-90 active:bg-white/20 active:shadow-[0_8px_24px_rgba(0,0,0,0.4)] active:shadow-white/15 liquid-glass-effect"
        }
      `}
      onClick={onClick}
    >
      <span className="relative z-10 text-white/70 text-xs font-medium tracking-[0.5px] uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        Mint Soon
      </span>
    </button>
  );
};
