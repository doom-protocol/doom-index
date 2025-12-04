"use client";

import { Header } from "@/components/ui/header";
import dynamic from "next/dynamic";
import type { NextPage } from "next";

const GalleryScene = dynamic(
  () => import("@/components/gallery/gallery-scene").then(mod => ({ default: mod.GalleryScene })),
  {
    ssr: false,
  },
);

const HomePage: NextPage = () => {
  return (
    <main style={{ width: "100%", height: "100%", margin: 0, padding: 0, overflow: "hidden" }}>
      <Header />
      <GalleryScene />
    </main>
  );
};

export default HomePage;
