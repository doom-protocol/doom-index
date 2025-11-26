import { ArchiveGrid } from "./archive-grid";

export const ArchiveLoader = () => {
  return (
    <div
      className="h-screen overflow-y-auto p-8 pb-[200px] font-sans"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      <h1 className="mb-4 normal-case" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        Archive
      </h1>
      <div className="mb-6 flex items-center gap-4">
        <div className="h-6 w-20 animate-pulse rounded bg-white/10" />
      </div>
      <ArchiveGrid items={[]} isLoading={true} skeletonCount={24} />
    </div>
  );
};
