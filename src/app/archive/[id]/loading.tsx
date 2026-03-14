import type { FC } from "react";

const SkeletonBar: FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse rounded bg-white/10 ${className}`} aria-hidden="true" />
);

const DetailLoading: FC = () => {
  return (
    <div
      className="flex h-screen flex-col lg:flex-row"
      style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
    >
      <div className="relative h-[50vh] w-full animate-pulse bg-black/50 lg:h-full lg:w-[60%]" />

      <div className="flex h-[50vh] flex-col space-y-6 overflow-y-auto p-6 lg:h-full lg:w-[40%]">
        <div className="space-y-3">
          <SkeletonBar className="h-6 w-40" />
          <div className="space-y-2 rounded-lg bg-white/5 p-4">
            <SkeletonBar className="h-4 w-48" />
            <SkeletonBar className="h-4 w-64" />
            <SkeletonBar className="h-4 w-56" />
            <SkeletonBar className="h-4 w-44" />
            <SkeletonBar className="h-4 w-36" />
          </div>
        </div>
        <div className="space-y-3">
          <SkeletonBar className="h-6 w-48" />
          <div className="space-y-1 rounded-lg bg-white/5 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonBar key={`param-skeleton-${String(i)}`} className="h-4 w-full" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <SkeletonBar className="h-6 w-24" />
          <div className="rounded-lg bg-white/5 p-4">
            <SkeletonBar className="h-16 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailLoading;
