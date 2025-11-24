"use client";

import { PaginationControls } from "./pagination-controls";
import { ArchiveGrid } from "./archive-grid";
import { ArchiveDetailView } from "./archive-detail-view";
import { DateFilter } from "./date-filter";
import React, { useMemo, useState } from "react";
import type { Painting } from "@/types/paintings";
import { sendGAEvent, GA_EVENTS } from "@/lib/analytics";
import { formatDateShort } from "@/utils/time";

interface ArchiveContentProps {
  items: Painting[];
  hasNextPage: boolean;
  page: number;
  startDate?: string;
  endDate?: string;
}

export const ArchiveContent: React.FC<ArchiveContentProps> = ({ items, hasNextPage, page, startDate, endDate }) => {
  const [selectedItem, setSelectedItem] = useState<Painting | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const itemsPerPage = 24;
  const hasPreviousPage = page > 1;

  const dateRange = useMemo(() => {
    if (items.length === 0) return null;

    const dates = items.map(item => new Date(item.timestamp));
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));

    return {
      start: formatDateShort(earliest),
      end: formatDateShort(latest),
      isSameDay: earliest.toDateString() === latest.toDateString(),
    };
  }, [items]);

  const handleItemClick = (item: Painting) => {
    setIsTransitioning(true);
    sendGAEvent(GA_EVENTS.ARCHIVE_PAINTING_CLICK, { painting_id: item.id });
    // Wait for fade out animation to complete before showing detail view
    setTimeout(() => {
      setSelectedItem(item);
    }, 300); // Match CSS transition duration
  };

  const handleClose = () => {
    setSelectedItem(null);
    setIsTransitioning(false);
  };

  // Show detail view if item is selected (after all hooks)
  if (selectedItem) {
    return <ArchiveDetailView item={selectedItem} onClose={handleClose} />;
  }

  return (
    <>
      <div
        className={`h-screen overflow-y-auto pb-[200px] p-8 transition-opacity duration-300 font-sans ${
          isTransitioning ? "opacity-0" : "opacity-100"
        }`}
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <h1 className="mb-4 normal-case" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
          Archive
        </h1>
        <div className="mb-6 flex items-center gap-4">
          <p className="text-white/70 normal-case" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
            Items: {items.length}
          </p>
          {dateRange && (
            <p
              className="text-sm text-white/50 normal-case"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              {dateRange.isSameDay ? dateRange.start : `${dateRange.start} - ${dateRange.end}`}
            </p>
          )}
        </div>
        <ArchiveGrid items={items} isLoading={false} skeletonCount={itemsPerPage} onItemClick={handleItemClick} />
      </div>
      <div className={`transition-opacity duration-300 ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
        <PaginationControls
          currentPage={page}
          itemsPerPage={itemsPerPage}
          totalItems={items.length}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          startDate={startDate}
          endDate={endDate}
        />
      </div>
      <div className={`transition-opacity duration-300 ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
        <DateFilter startDate={startDate} endDate={endDate} />
      </div>
    </>
  );
};
