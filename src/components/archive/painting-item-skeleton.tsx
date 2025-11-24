"use client";

import React from "react";

export const PaintingSkeleton: React.FC = () => {
  return (
    <div className="aspect-square w-full animate-pulse rounded-lg border border-white/10 bg-black/20">
      <div className="h-full w-full rounded-lg bg-gradient-to-br from-white/10 via-white/5 to-white/10" />
    </div>
  );
};
