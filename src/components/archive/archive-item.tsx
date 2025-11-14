"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { ArchiveItem } from "@/types/archive";
import { ArchiveItemSkeleton } from "./archive-item-skeleton";
import { logger } from "@/utils/logger";

interface ArchiveItemProps {
  item: ArchiveItem;
  onClick?: () => void;
}

export const ArchiveItemComponent: React.FC<ArchiveItemProps> = ({ item, onClick }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const timeLabel = (() => {
    const date = new Date(item.timestamp);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = monthNames[date.getMonth()];
    const d = date.getDate();
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${m} ${d}, ${hh}:${mm}`;
  })();

  const handleImageLoad = () => {
    logger.debug("archive.item.image.loaded", {
      itemId: item.id,
      imageUrl: item.imageUrl,
    });
    setIsLoading(false);
  };

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    logger.error("archive.item.image.failed", {
      itemId: item.id,
      imageUrl: item.imageUrl,
      error: event,
    });
    setIsLoading(false);
    setHasError(true);
  };

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
      {isLoading && !hasError && (
        <div className="absolute inset-0 z-10">
          <ArchiveItemSkeleton />
        </div>
      )}
      {hasError ? (
        <div className="flex h-full w-full items-center justify-center bg-black/40">
          <span className="text-xs text-white/50">Failed to load</span>
        </div>
      ) : (
        <Image
          src={item.imageUrl}
          alt={`Archive item ${item.id}`}
          fill
          className={`object-cover transition-opacity ${isLoading ? "opacity-0" : "opacity-100"}`}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}
    </div>
  );
};
