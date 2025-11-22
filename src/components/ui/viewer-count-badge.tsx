"use client";

import { useViewerCount } from "@/hooks/use-viewer-count";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import { type FC } from "react";

export const ViewerCountBadge: FC = () => {
  const { count } = useViewerCount();
  const animatedCount = useAnimatedNumber(count ?? 1, 500);

  // Display at least 1 even if count is 0 or null
  const displayCount = Math.max(1, animatedCount);

  return (
    <div className="flex items-center gap-1.5 text-xs text-white/70">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white/60" />
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5 text-white/60"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <span className="font-medium tabular-nums">{displayCount}</span>
    </div>
  );
};
