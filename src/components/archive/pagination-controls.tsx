"use client";

import React from "react";

interface PaginationControlsProps {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNext: () => void;
  onPrevious: () => void;
  isLoading?: boolean;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  itemsPerPage,
  totalItems,
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  isLoading = false,
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = startItem + totalItems - 1;
  const rangeText = totalItems > 0 ? `${startItem}-${endItem}` : "0 of 0";

  const isPreviousDisabled = !hasPreviousPage || isLoading;
  const isNextDisabled = !hasNextPage || isLoading;

  return (
    <div className="fixed bottom-[75px] left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 backdrop-blur-xl opacity-60 hover:opacity-100 transition-opacity duration-200 md:bottom-[60px] md:gap-2 md:px-3 md:py-1.5">
      <button
        type="button"
        onClick={onPrevious}
        disabled={isPreviousDisabled}
        className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-all cursor-pointer md:px-2.5 md:py-1 md:text-xs ${
          isPreviousDisabled
            ? "cursor-not-allowed border-white/20 bg-white/5 text-white/40 opacity-50"
            : "border-white/20 bg-white/10 text-white hover:border-white/30 hover:bg-white/15"
        }`}
      >
        PREV
      </button>

      <span className="min-w-[70px] text-center text-[10px] text-white/80 md:min-w-[80px] md:text-xs">{rangeText}</span>

      <button
        type="button"
        onClick={onNext}
        disabled={isNextDisabled}
        className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-all cursor-pointer md:px-2.5 md:py-1 md:text-xs ${
          isNextDisabled
            ? "cursor-not-allowed border-white/20 bg-white/5 text-white/40 opacity-50"
            : "border-white/20 bg-white/10 text-white hover:border-white/30 hover:bg-white/15"
        }`}
      >
        NEXT
      </button>
    </div>
  );
};
