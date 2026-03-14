"use client";

import { Providers } from "@/app/providers";
import { GallerySceneShell } from "@/components/gallery/gallery-scene-shell";
import { Header } from "@/components/ui/header";
import type { PaintingMetadata } from "@/types/paintings";
import type { FC } from "react";

interface HomeClientProps {
  initialPainting?: PaintingMetadata | null;
}

const HomeClient: FC<HomeClientProps> = ({ initialPainting }) => {
  return (
    <Providers>
      <main
        style={{
          width: "100%",
          height: "100%",
          margin: 0,
          padding: 0,
          overflow: "hidden",
        }}
      >
        <Header />
        <GallerySceneShell initialPainting={initialPainting} />
      </main>
    </Providers>
  );
};

export default HomeClient;
