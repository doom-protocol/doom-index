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
        className="h-screen overflow-y-auto px-8 pb-[200px] pt-28 font-sans sm:pt-32"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <h1 className="mb-4 normal-case" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
          Archive
        </h1>
        <div className="mb-6 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-start sm:text-left">
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
            <SkeletonBar className="h-4 w-20 rounded-full" />
          </p>
        </div>
        <ArchiveGrid items={[]} isLoading skeletonCount={ITEMS_PER_PAGE} />
      </div>

      <div className="fixed bottom-[75px] left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 opacity-60 backdrop-blur-xl md:bottom-[60px] md:gap-2 md:px-3 md:py-1.5">
        <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] font-medium text-transparent md:px-2.5 md:py-1 md:text-xs">
          <SkeletonBar className="h-3 w-10 bg-white/20" />
        </span>
        <span className="min-w-[70px] text-center text-[10px] text-transparent md:min-w-[80px] md:text-xs">
          <SkeletonBar className="mx-auto h-3 w-16 bg-white/20" />
        </span>
        <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] font-medium text-transparent md:px-2.5 md:py-1 md:text-xs">
          <SkeletonBar className="h-3 w-10 bg-white/20" />
        </span>
      </div>

      <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-white/10 bg-black/40 px-1.5 py-3 backdrop-blur-md md:p-3">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2.5 md:flex-row md:justify-center md:gap-2">
          <div className="flex w-full flex-row items-stretch justify-around md:w-auto md:flex-row md:items-center md:gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] whitespace-nowrap text-white/70 md:text-xs">From:</span>
              <SkeletonBar className="h-10 w-28 md:h-8 md:w-36" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] whitespace-nowrap text-white/70 md:text-xs">To:</span>
              <SkeletonBar className="h-10 w-28 md:h-8 md:w-36" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
