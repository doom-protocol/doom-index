"use client";

import React from "react";
import type { ArchiveItem } from "@/types/archive";
import { ArchiveItemComponent } from "./archive-item";
import { ArchiveItemSkeleton } from "./archive-item-skeleton";

interface ArchiveGridProps {
  items: ArchiveItem[];
  isLoading?: boolean;
  skeletonCount?: number;
  onItemClick?: (item: ArchiveItem) => void;
}

export const ArchiveGrid: React.FC<ArchiveGridProps> = ({
  items,
  isLoading = false,
  skeletonCount = 20,
  onItemClick,
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map(item => (
        <ArchiveItemComponent key={item.id} item={item} onClick={() => onItemClick?.(item)} />
      ))}
      {isLoading &&
        Array.from({ length: skeletonCount }).map((_, index) => <ArchiveItemSkeleton key={`skeleton-${index}`} />)}
    </div>
  );
};
