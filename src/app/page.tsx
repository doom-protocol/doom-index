"use client";

import { Header } from "@/components/ui/header";
import dynamic from "next/dynamic";

const GalleryScene = dynamic(
  () => import("@/components/gallery/gallery-scene").then(mod => ({ default: mod.GalleryScene })),
  {
    ssr: false,
  },
);

export default function Home() {
  return (
    <main style={{ width: "100%", height: "100%", margin: 0, padding: 0, overflow: "hidden" }}>
      <Header />
      <GalleryScene />
    </main>
  );
}
