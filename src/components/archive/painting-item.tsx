"use client";

import { ProgressiveImage } from "@/components/ui/progressive-image";
import { GA_EVENTS, sendGAEvent } from "@/lib/analytics";
import { getArchiveImageSources } from "@/lib/archive-image-sources";
import type { ResponsiveSizes } from "@/types/domain";
import type { Painting } from "@/types/paintings";
import Link from "next/link";
import { useMemo } from "react";
import type { FC } from "react";
import { PaintingSkeleton } from "./painting-item-skeleton";

const ARCHIVE_GRID_SIZES: ResponsiveSizes = [
  { maxWidth: 640, size: "100vw" },
  { maxWidth: 768, size: "50vw" },
  { maxWidth: 1024, size: "33vw" },
  { maxWidth: 1280, size: "25vw" },
  { size: "16vw" },
];

interface PaintingProps {
  from?: string;
  item: Painting;
  loading?: "eager" | "lazy";
  page: number;
  to?: string;
}

export const PaintingComponent: FC<PaintingProps> = ({ from, item, loading, page, to }) => {
  const imageSources = useMemo(() => getArchiveImageSources(item.imageUrl), [item.imageUrl]);
  const detailHref = useMemo(() => {
    const params = new URLSearchParams();
    if (page > 1) {
      params.set("page", String(page));
    }
    if (from) {
      params.set("from", from);
    }
    if (to) {
      params.set("to", to);
    }
    params.set("selected", item.id);
    return `/archive?${params.toString()}`;
  }, [from, item.id, page, to]);
  const timeLabel = (() => {
    const date = new Date(item.timestamp);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = monthNames[date.getMonth()];
    const d = date.getDate();
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${m} ${String(d)}, ${hh}:${mm}`;
  })();

  return (
    <Link
      href={detailHref}
      prefetch={false}
      className="group relative aspect-square w-full cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-black/20 transition-all hover:border-white/20"
      onClick={() => {
        sendGAEvent(GA_EVENTS.ARCHIVE_PAINTING_CLICK, { painting_id: item.id });
      }}
    >
      <div className="pointer-events-none absolute top-1 left-1 z-20 rounded bg-black/60 px-1.5 py-0.5 text-[10px] leading-none text-white/80 backdrop-blur-sm">
        {timeLabel}
      </div>
      <ProgressiveImage
        src={item.imageUrl}
        sources={imageSources}
        alt={`Archive item ${item.id}`}
        fill
        sizes={ARCHIVE_GRID_SIZES}
        loading={loading}
        className="object-cover transition-opacity"
        skeleton={<PaintingSkeleton />}
        logContext={{
          itemId: item.id,
          imageUrl: item.imageUrl,
        }}
      />
    </Link>
  );
};
