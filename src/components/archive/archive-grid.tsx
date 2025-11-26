"use client";

import type { Painting } from "@/types/paintings";
import React from "react";
import { PaintingComponent } from "./painting-item";
import { PaintingSkeleton } from "./painting-item-skeleton";

interface ArchiveGridProps {
  items: Painting[];
  isLoading?: boolean;
  skeletonCount?: number;
  onItemClick?: (item: Painting) => void;
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
        <PaintingComponent key={item.id} item={item} onClick={() => onItemClick?.(item)} />
      ))}
      {isLoading &&
        Array.from({ length: skeletonCount }).map((_, index) => <PaintingSkeleton key={`skeleton-${index}`} />)}
    </div>
  );
};
