"use client";

import { useLinkStatus } from "next/link";
import type { FC } from "react";

export const LoadingIndicator: FC = () => {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={`fixed top-0 right-0 left-0 z-[9999] h-1 transition-opacity duration-200 ${
        pending ? "opacity-100" : "opacity-0"
      }`}
      style={{
        background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
        animation: pending ? "loading-indicator-bar 1s ease-in-out infinite" : "none",
      }}
    />
  );
};
