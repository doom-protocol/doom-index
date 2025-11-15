"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ArchiveFramedPainting } from "./archive-framed-painting";
import { ArchivePaintingSkeleton } from "./archive-painting-skeleton";
import { useMobile } from "@/hooks/use-mobile";
import { getGridConfig, calculateGridPosition, type GridConfig } from "@/lib/pure/archive-grid";
import { calculateVisibleRange, type VisibleRange } from "@/lib/pure/archive-viewport";
import type { ArchiveItem } from "@/types/archive";

interface ArchivePaintingsGridProps {
  items: ArchiveItem[];
  onItemClick?: (item: ArchiveItem) => void;
  selectedItem?: ArchiveItem | null;
}

const INITIAL_CAMERA_Z = 0.8;
const BUFFER_ROWS = 3;

const PaintingWithSkeleton: React.FC<{
  item: ArchiveItem;
  position: [number, number, number];
  onItemClick?: (item: ArchiveItem) => void;
}> = ({ item, position, onItemClick }) => {
  return (
    <Suspense fallback={<ArchivePaintingSkeleton position={position} />}>
      <ArchiveFramedPainting
        item={item}
        framePosition={position}
        onPointerClick={onItemClick ? (item, _event) => onItemClick(item) : undefined}
      />
    </Suspense>
  );
};

export const ArchivePaintingsGrid: React.FC<ArchivePaintingsGridProps> = ({ items, onItemClick, selectedItem }) => {
  const isMobile = useMobile();
  const { camera } = useThree();
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({ start: 0, end: items.length });

  const gridConfig = useMemo<GridConfig>(() => getGridConfig(isMobile), [isMobile]);

  // Calculate visible range every frame
  useFrame(() => {
    const newRange = calculateVisibleRange(camera.position.z, items.length, gridConfig, INITIAL_CAMERA_Z, BUFFER_ROWS);
    if (newRange.start !== visibleRange.start || newRange.end !== visibleRange.end) {
      setVisibleRange(newRange);
    }
  });

  // Calculate positions for visible items only
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, localIndex) => {
      const globalIndex = visibleRange.start + localIndex;
      const basePosition: [number, number, number] = [0, 0.8, 4.0];
      const position = calculateGridPosition(globalIndex, gridConfig, basePosition);
      return { item, position };
    });
  }, [items, visibleRange, gridConfig]);

  return (
    <>
      {visibleItems.map(({ item, position }) => (
        <group key={item.id} visible={!selectedItem || selectedItem.id === item.id}>
          <PaintingWithSkeleton item={item} position={position} onItemClick={onItemClick} />
        </group>
      ))}
    </>
  );
};
