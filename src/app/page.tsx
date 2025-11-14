"use client";

import { GalleryScene } from "@/components/gallery/gallery-scene";
import { TopBar } from "@/components/ui/top-bar";

export default function Home() {
  return (
    <main style={{ width: "100%", height: "100%", margin: 0, padding: 0, overflow: "hidden" }}>
      <TopBar />
      <GalleryScene />
    </main>
  );
}
