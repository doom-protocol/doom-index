"use client";

import { Header } from "@/components/ui/header";
import type { PaintingMetadata } from "@/types/paintings";
import dynamic from "next/dynamic";

const HomeScene = dynamic(
  async () => {
    const mod = await import("@/components/gallery/gallery-scene");
    return { default: mod.GalleryScene };
  },
  {
    ssr: false,
  },
);

export function HomeView({ initialPainting }: { initialPainting: PaintingMetadata | null }) {
  return (
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
      <HomeScene initialPainting={initialPainting} />
    </main>
  );
}
