"use client";

import type { PaintingMetadata } from "@/types/paintings";
import dynamic from "next/dynamic";
import type { FC } from "react";

const GalleryScene = dynamic(
  async () =>
    import("@/components/gallery/gallery-scene").then((mod) => ({
      default: mod.GalleryScene,
    })),
  {
    ssr: false,
  },
);

interface HomeClientProps {
  initialPainting: PaintingMetadata | null;
}

export const HomeClient: FC<HomeClientProps> = ({ initialPainting }) => {
  return <GalleryScene initialPainting={initialPainting} />;
};
