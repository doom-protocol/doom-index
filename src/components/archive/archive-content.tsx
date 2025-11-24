import { PaginationControls } from "./pagination-controls";
import { ArchiveGrid } from "./archive-grid";
import { DateFilter } from "./date-filter";
import React from "react";
import type { Painting } from "@/types/paintings";
import { formatDateShort } from "@/utils/time";

interface ArchiveContentProps {
  items: Painting[];
  hasNextPage: boolean;
  page: number;
}

export const ArchiveContent: React.FC<ArchiveContentProps> = ({ items, hasNextPage, page }) => {
  const itemsPerPage = 24;
  const hasPreviousPage = page > 1;

  const dateRange = (() => {
    if (items.length === 0) return null;

    const dates = items.map(item => new Date(item.timestamp));
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));

    return {
      start: formatDateShort(earliest),
      end: formatDateShort(latest),
      isSameDay: earliest.toDateString() === latest.toDateString(),
    };
  })();

  return (
    <>
      <div
        className="h-screen overflow-y-auto pb-[200px] p-8 font-sans"
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
        <ArchiveGrid items={items} isLoading={false} skeletonCount={itemsPerPage} />
      </div>
      <PaginationControls
        currentPage={page}
        itemsPerPage={itemsPerPage}
        totalItems={items.length}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
      />
      <DateFilter />
    </>
  );
};
