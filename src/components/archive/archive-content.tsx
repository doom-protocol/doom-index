"use client";

import type { Painting } from "@/types/paintings";
import { formatDateShort } from "@/utils/time";
import { useMemo } from "react";
import type { FC } from "react";
import { ArchiveGrid } from "./archive-grid";
import { DateFilter } from "./date-filter";
import { PaginationControls } from "./pagination-controls";

interface ArchiveContentProps {
  items: Painting[];
  hasNextPage: boolean;
  page: number;
  from?: string;
  to?: string;
}

export const ArchiveContent: FC<ArchiveContentProps> = ({ items, hasNextPage, page, from, to }) => {
  const itemsPerPage = 24;
  const hasPreviousPage = page > 1;

  const dateRange = useMemo(() => {
    if (items.length === 0) return null;

    const dates = items.map((item) => new Date(item.timestamp));
    const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));

    return {
      start: formatDateShort(earliest),
      end: formatDateShort(latest),
      isSameDay: earliest.toDateString() === latest.toDateString(),
    };
  }, [items]);

  return (
    <>
      <div
        className="h-screen overflow-y-auto px-8 pt-28 pb-[200px] font-sans sm:pt-32"
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
        from={from}
        to={to}
      />
      <DateFilter from={from} to={to} />
    </>
  );
};
