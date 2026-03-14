"use client";

import type { Painting } from "@/types/paintings";
import type { FC } from "react";
import { PaintingComponent } from "./painting-item";
import { PaintingSkeleton } from "./painting-item-skeleton";

interface ArchiveGridProps {
  items: Painting[];
  isLoading?: boolean;
  skeletonCount?: number;
  onItemClick?: (item: Painting) => void;
}

const EAGER_ARCHIVE_IMAGE_COUNT = 6;

export const ArchiveGrid: FC<ArchiveGridProps> = ({ items, isLoading = false, skeletonCount = 20, onItemClick }) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map((item, index) => (
        <PaintingComponent
          key={item.id}
          item={item}
          loading={index < EAGER_ARCHIVE_IMAGE_COUNT ? "eager" : undefined}
          onClick={() => onItemClick?.(item)}
        />
      ))}
      {isLoading &&
        Array.from({ length: skeletonCount }).map((_, index) => <PaintingSkeleton key={`skeleton-${String(index)}`} />)}
    </div>
  );
};
