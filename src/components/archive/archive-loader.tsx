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
        <div className="mb-6 flex items-center gap-4" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
          <p className="flex items-center gap-2 text-white/70 normal-case">
            Items:
            <SkeletonBar className="h-4 w-12 rounded-full" />
          </p>
          <p className="flex items-center gap-2 text-sm text-white/50 normal-case">
            <SkeletonBar className="h-4 w-24 rounded-full" />
          </p>
        </div>
        <ArchiveGrid items={[]} isLoading skeletonCount={ITEMS_PER_PAGE} />
      </div>

      <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-white/10 bg-black/40 px-1.5 py-3 backdrop-blur-md md:p-3">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2.5 md:flex-row md:justify-center md:gap-2">
          <div className="flex w-full flex-row items-stretch justify-around md:w-auto md:flex-row md:items-center md:gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] whitespace-nowrap text-white/70 md:text-xs">From:</span>
              <div className="w-30 animate-pulse rounded border border-white/20 bg-white/10 px-2 py-2 text-[9px] md:w-36 md:py-1 md:text-[11px]">
                <span className="invisible">0000-00-00</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] whitespace-nowrap text-white/70 md:text-xs">To:</span>
              <div className="w-30 animate-pulse rounded border border-white/20 bg-white/10 px-2 py-2 text-[9px] md:w-36 md:py-1 md:text-[11px]">
                <span className="invisible">0000-00-00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
