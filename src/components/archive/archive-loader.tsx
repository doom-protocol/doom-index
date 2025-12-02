import { type FC } from "react";
import { ArchiveGrid } from "./archive-grid";

const ITEMS_PER_PAGE = 24;

const SkeletonBar: FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse rounded bg-white/10 ${className}`} aria-hidden="true" />
);

export const ArchiveLoader: FC = () => {
  return (
    <>
      <div
        className="h-screen overflow-y-auto px-4 pb-[220px] pt-24 font-sans sm:px-8 sm:pt-32"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <h1 className="mb-4 normal-case" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
          Archive
        </h1>
        <div className="mb-6 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-start sm:text-left">
          <p
            className="flex items-center gap-2 text-white/70 normal-case"
            style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
          >
            Items:
            <SkeletonBar className="h-4 w-10 rounded-full" />
          </p>
          <p
            className="flex items-center gap-2 text-sm text-white/50 normal-case"
            style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
          >
            Date range:
            <SkeletonBar className="h-4 w-20 rounded-full" />
          </p>
        </div>
        <ArchiveGrid items={[]} isLoading skeletonCount={ITEMS_PER_PAGE} />
      </div>

      <div className="fixed bottom-24 left-1/2 z-[1000] flex w-[calc(100%-2rem)] -translate-x-1/2 flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 py-2 opacity-80 backdrop-blur-xl sm:bottom-[70px] sm:w-auto sm:flex-row sm:gap-2 sm:px-3.5 sm:py-1.5">
        <span className="flex w-full items-center justify-center rounded border border-white/20 px-2 py-1 text-[11px] font-medium text-transparent sm:w-auto sm:text-xs">
          <SkeletonBar className="h-3 w-12 bg-white/20" />
        </span>
        <span className="flex w-full items-center justify-center text-center text-[11px] text-transparent sm:w-auto sm:min-w-[90px] sm:text-xs">
          <SkeletonBar className="mx-auto h-3 w-20 bg-white/20" />
        </span>
        <span className="flex w-full items-center justify-center rounded border border-white/20 px-2 py-1 text-[11px] font-medium text-transparent sm:w-auto sm:text-xs">
          <SkeletonBar className="h-3 w-12 bg-white/20" />
        </span>
      </div>

      <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-white/10 bg-black/40 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-3">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-[11px] whitespace-nowrap text-white/70 sm:text-xs">From</span>
              <SkeletonBar className="h-10 w-full min-w-[140px] sm:h-8 sm:w-36" />
            </div>
            <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-[11px] whitespace-nowrap text-white/70 sm:text-xs">To</span>
              <SkeletonBar className="h-10 w-full min-w-[140px] sm:h-8 sm:w-36" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
