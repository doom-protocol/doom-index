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
    <div className="fixed bottom-[120px] left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/10 bg-black/80 px-3 py-1.5 backdrop-blur-xl">
      <button
        type="button"
        onClick={onPrevious}
        disabled={isPreviousDisabled}
        className={`rounded border px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
          isPreviousDisabled
            ? "cursor-not-allowed border-white/20 bg-white/5 text-white/40 opacity-50"
            : "border-white/20 bg-white/10 text-white hover:border-white/30 hover:bg-white/15"
        }`}
      >
        PREV
      </button>

      <span className="min-w-[80px] text-center text-xs text-white/80">{rangeText}</span>

      <button
        type="button"
        onClick={onNext}
        disabled={isNextDisabled}
        className={`rounded border px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
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
