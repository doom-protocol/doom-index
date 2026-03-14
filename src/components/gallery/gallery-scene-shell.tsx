"use client";

import type { PaintingMetadata } from "@/types/paintings";
import dynamic from "next/dynamic";
import type { FC } from "react";

const DynamicGalleryScene = dynamic(
  async () =>
    import("./gallery-scene").then((mod) => ({
      default: mod.GalleryScene,
    })),
  {
    ssr: false,
  },
);

interface GallerySceneShellProps {
  initialPainting?: PaintingMetadata | null;
}

export const GallerySceneShell: FC<GallerySceneShellProps> = (props) => {
  return <DynamicGalleryScene {...props} />;
};
