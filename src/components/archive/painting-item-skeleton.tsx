"use client";

import { type FC } from "react";

export const PaintingSkeleton: FC = () => {
  return (
    <div className="group relative aspect-square w-full overflow-hidden rounded-lg border border-white/10 bg-black/20">
      <div className="h-full w-full animate-pulse bg-gradient-to-br from-white/10 via-white/5 to-white/10" />
    </div>
  );
};
