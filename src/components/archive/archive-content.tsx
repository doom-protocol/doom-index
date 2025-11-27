"use client";

import { GA_EVENTS, sendGAEvent } from "@/lib/analytics";
import type { Painting } from "@/types/paintings";
import { formatDateShort } from "@/utils/time";
import { useMemo, useState, Suspense, lazy, type FC } from "react";
import { ArchiveGrid } from "./archive-grid";
import { DateFilter } from "./date-filter";
import { PaginationControls } from "./pagination-controls";

const ArchiveDetailView = lazy(() => import("./archive-detail-view").then(mod => ({ default: mod.ArchiveDetailView })));

interface ArchiveContentProps {
  items: Painting[];
  hasNextPage: boolean;
  page: number;
  from?: string;
  to?: string;
}

export const ArchiveContent: FC<ArchiveContentProps> = ({ items, hasNextPage, page, from, to }) => {
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
    return (
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
        <ArchiveDetailView item={selectedItem} onClose={handleClose} />
      </Suspense>
    );
  }

  return (
    <>
      <div
        className={`h-screen overflow-y-auto p-8 pb-[200px] font-sans transition-opacity duration-300 ${
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
          from={from}
          to={to}
        />
      </div>
      <div className={`transition-opacity duration-300 ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
        <DateFilter from={from} to={to} />
      </div>
    </>
  );
};
