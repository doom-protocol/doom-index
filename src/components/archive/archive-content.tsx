"use client";

import { useArchive } from "@/hooks/use-archive";
import { PaginationControls } from "./pagination-controls";
import { ArchiveGrid } from "./archive-grid";
import { ArchiveDetailView } from "./archive-detail-view";
import { DateFilter } from "./date-filter";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useMemo, useState, useEffect } from "react";
import type { Painting } from "@/types/paintings";
import { useTRPCClient } from "@/lib/trpc/client";
import { logger } from "@/utils/logger";
import { sendGAEvent, GA_EVENTS } from "@/lib/analytics";

interface ArchiveContentProps {
  startDate?: string;
  endDate?: string;
}

export const ArchiveContent: React.FC<ArchiveContentProps> = ({ startDate, endDate }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const client = useTRPCClient();
  const [selectedItem, setSelectedItem] = useState<Painting | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Page number from URL (1-indexed)
  const currentPageNumber = parseInt(searchParams.get("page") || "1", 10);
  const pageNumber = Math.max(1, currentPageNumber);

  // Store cursor for each page (page number → cursor mapping)
  // page N's cursor is stored at index N, and is used to fetch page N+1
  const [pageCursors, setPageCursors] = useState<Map<number, string>>(new Map());
  const [loadingCursors, setLoadingCursors] = useState(false);

  const itemsPerPage = 24;

  // Get cursor for current page (page N uses cursor from page N-1)
  // pageCursors stores: page N's cursor at index N (used to fetch page N+1)
  // So to fetch page N, we need cursor from page N-1
  const currentCursor = useMemo(() => {
    if (pageNumber === 1) {
      return undefined; // First page has no cursor
    }
    const cursor = pageCursors.get(pageNumber - 1);
    logger.debug("paintings-content.current-cursor", {
      pageNumber,
      cursor: cursor || "undefined",
      pageCursorsSize: pageCursors.size,
      allCursors: Array.from(pageCursors.entries()).map(([k, v]) => `page${k}=${v.substring(0, 20)}...`),
    });
    return cursor;
  }, [pageNumber, pageCursors]);

  // Load pages sequentially to get cursor for target page if needed
  useEffect(() => {
    if (pageNumber === 1 || currentCursor || loadingCursors) return;

    logger.debug("paintings-content.loading-cursors", {
      pageNumber,
      currentCursor: currentCursor || "undefined",
    });

    const loadPagesSequentially = async () => {
      setLoadingCursors(true);
      let cursor: string | undefined = undefined;

      // Load pages from 1 to pageNumber - 1 to get the cursor
      for (let page = 1; page < pageNumber; page++) {
        try {
          logger.debug("paintings-content.loading-page", { page, cursor: cursor || "undefined" });
          const pageData = await client.paintings.list.query({
            limit: itemsPerPage,
            cursor,
            startDate,
            endDate,
          });

          if (pageData.cursor) {
            setPageCursors(prev => {
              // Skip if already stored
              if (prev.has(page)) return prev;
              const next = new Map(prev);
              next.set(page, pageData.cursor!);
              logger.debug("paintings-content.cursor-stored", { page, cursor: pageData.cursor });
              return next;
            });
            cursor = pageData.cursor;
          } else {
            // No more pages, break
            logger.debug("paintings-content.no-more-pages", { page });
            break;
          }
        } catch (error) {
          logger.error("Failed to load page for cursor", { page, error });
          break;
        }
      }

      setLoadingCursors(false);
    };

    loadPagesSequentially();
  }, [pageNumber, currentCursor, loadingCursors, client, itemsPerPage, startDate, endDate]);

  const awaitingCursor = pageNumber > 1 && !currentCursor;

  const { data, error, isLoading, refetch, isError } = useArchive({
    cursor: currentCursor,
    limit: itemsPerPage,
    startDate,
    endDate,
    enabled: !awaitingCursor,
  });

  // Store cursor for current page when data is received
  useEffect(() => {
    if (!data || pageNumber <= 0) return;

    logger.debug("paintings-content.checking-cursor", {
      pageNumber,
      hasCursor: !!data.cursor,
      cursor: data.cursor || "none",
      hasMore: data.hasMore,
    });

    if (data.cursor) {
      setPageCursors(prev => {
        // Skip if already stored with the same cursor
        const existingCursor = prev.get(pageNumber);
        if (existingCursor === data.cursor) {
          logger.debug("paintings-content.cursor-already-stored", {
            pageNumber,
            cursor: data.cursor,
            existingCursor,
          });
          return prev;
        }
        const next = new Map(prev);
        // Store cursor for current page (used to fetch next page)
        // page N's cursor is stored at index N, and is used to fetch page N+1
        next.set(pageNumber, data.cursor!);
        logger.debug("paintings-content.page-cursor-stored", {
          pageNumber,
          cursor: data.cursor,
          allCursors: Array.from(next.entries()).map(([k, v]) => `page${k}=${v.substring(0, 20)}...`),
        });
        return next;
      });
    } else if (data.hasMore) {
      logger.warn("paintings-content.no-cursor-but-has-more", {
        pageNumber,
        hasMore: data.hasMore,
        itemsCount: data.items.length,
      });
    }
  }, [data, pageNumber]);

  // Reset scroll position when page or filters change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pageNumber, startDate, endDate]);

  // Reset page cursors when filters change
  useEffect(() => {
    setPageCursors(new Map());
  }, [startDate, endDate]);

  const displayedItems = useMemo(() => data?.items ?? [], [data?.items]);

  // hasNextPage: true if current page has more items
  const hasNextPage = data?.hasMore ?? false;
  const hasPreviousPage = pageNumber > 1;

  logger.debug("paintings-content.pagination-state", {
    pageNumber,
    hasNextPage,
    hasPreviousPage,
    currentCursor: currentCursor || "undefined",
    pageCursorsSize: pageCursors.size,
    dataHasMore: data?.hasMore ?? false,
    itemsCount: displayedItems.length,
  });

  // Calculate date range for display (must be before early returns)
  const dateRange = useMemo(() => {
    if (displayedItems.length === 0) return null;

    const dates = displayedItems.map(item => new Date(item.timestamp));
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));

    const formatDate = (date: Date) => {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const m = monthNames[date.getMonth()];
      const d = date.getDate();
      return `${m} ${d}`;
    };

    return {
      start: formatDate(earliest),
      end: formatDate(latest),
      isSameDay: earliest.toDateString() === latest.toDateString(),
    };
  }, [displayedItems]);

  // Error state
  if (isError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
        <div className="rounded-lg border border-red-300/30 bg-red-500/10 p-4 text-center text-red-400">
          <h2 className="mb-2 text-xl">Error loading paintings</h2>
          <p className="text-sm opacity-90">
            {error instanceof Error ? error.message : "Failed to load paintings items"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-lg border border-white/20 bg-white/10 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-white/15 hover:border-white/30"
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading || awaitingCursor) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <p className="text-white/70">Loading paintings...</p>
      </div>
    );
  }

  const updateURL = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", page.toString());
    }
    router.push(`/paintings?${params.toString()}`, { scroll: false });
  };

  const handleNext = () => {
    if (hasNextPage) {
      sendGAEvent(GA_EVENTS.ARCHIVE_PAGE_CHANGE, { page: pageNumber + 1, direction: "next" });
      updateURL(pageNumber + 1);
    }
  };

  const handlePrevious = () => {
    if (hasPreviousPage) {
      sendGAEvent(GA_EVENTS.ARCHIVE_PAGE_CHANGE, { page: pageNumber - 1, direction: "prev" });
      updateURL(pageNumber - 1);
    }
  };

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
            Items: {displayedItems.length}
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
        <ArchiveGrid
          items={displayedItems}
          isLoading={isLoading}
          skeletonCount={itemsPerPage}
          onItemClick={handleItemClick}
        />
      </div>
      <div className={`transition-opacity duration-300 ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
        <PaginationControls
          currentPage={pageNumber}
          itemsPerPage={itemsPerPage}
          totalItems={displayedItems.length}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onNext={handleNext}
          onPrevious={handlePrevious}
          isLoading={isLoading}
        />
      </div>
      <div className={`transition-opacity duration-300 ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
        <DateFilter />
      </div>
    </>
  );
};
