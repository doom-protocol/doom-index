"use client";

import React from "react";
import Link from "next/link";

interface PaginationControlsProps {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  itemsPerPage,
  totalItems,
  hasNextPage,
  hasPreviousPage,
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = startItem + totalItems - 1;
  const rangeText = totalItems > 0 ? `${startItem}-${endItem}` : "0 of 0";

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams();
    if (page > 1) {
      params.set("page", page.toString());
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  };

  return (
    <div className="fixed bottom-[75px] left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 backdrop-blur-xl opacity-60 hover:opacity-100 transition-opacity duration-200 md:bottom-[60px] md:gap-2 md:px-3 md:py-1.5">
      {hasPreviousPage ? (
        <Link
          href={`/archive${createPageUrl(currentPage - 1)}`}
          className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white transition-all hover:border-white/30 hover:bg-white/15 md:px-2.5 md:py-1 md:text-xs"
        >
          PREV
        </Link>
      ) : (
        <span className="rounded border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/40 opacity-50 md:px-2.5 md:py-1 md:text-xs">
          PREV
        </span>
      )}

      <span className="min-w-[70px] text-center text-[10px] text-white/80 md:min-w-[80px] md:text-xs">{rangeText}</span>

      {hasNextPage ? (
        <Link
          href={`/archive${createPageUrl(currentPage + 1)}`}
          className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white transition-all hover:border-white/30 hover:bg-white/15 md:px-2.5 md:py-1 md:text-xs"
        >
          NEXT
        </Link>
      ) : (
        <span className="rounded border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/40 opacity-50 md:px-2.5 md:py-1 md:text-xs"></span>
      )}
    </div>
  );
};
