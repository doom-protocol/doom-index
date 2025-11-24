"use client";

import React from "react";
import type { Painting } from "@/types/paintings";
import { PaintingSkeleton } from "./painting-item-skeleton";
import { ProgressiveImage } from "@/components/ui/progressive-image";

interface PaintingProps {
  item: Painting;
  onClick?: () => void;
}

export const PaintingComponent: React.FC<PaintingProps> = ({ item, onClick }) => {
  const timeLabel = (() => {
    const date = new Date(item.timestamp);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = monthNames[date.getMonth()];
    const d = date.getDate();
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${m} ${d}, ${hh}:${mm}`;
  })();

  return (
    <div
      className="group relative aspect-square w-full cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-black/20 transition-all hover:border-white/20"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* time label */}
      <div className="pointer-events-none absolute left-1 top-1 z-20 rounded bg-black/60 px-1.5 py-0.5 text-[10px] leading-none text-white/80 backdrop-blur-sm">
        {timeLabel}
      </div>
      <ProgressiveImage
        src={item.imageUrl}
        alt={`Archive item ${item.id}`}
        fill
        className="object-cover transition-opacity"
        skeleton={<PaintingSkeleton />}
        logContext={{
          itemId: item.id,
          imageUrl: item.imageUrl,
        }}
      />
    </div>
  );
};
