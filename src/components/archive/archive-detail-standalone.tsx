"use client";

import { GalleryRoom } from "@/components/gallery/gallery-room";
import { Lights } from "@/components/gallery/lights";
import { sendGAEvent } from "@/lib/analytics";
import type { Painting } from "@/types/paintings";
import { Canvas } from "@react-three/fiber";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import type { FC } from "react";
import { ACESFilmicToneMapping } from "three";
import { ArchiveFramedPainting } from "./archive-framed-painting";
import { ArchiveMetadataPanel } from "./archive-metadata-panel";

interface ArchiveDetailStandaloneProps {
  item: Painting;
}

const DETAIL_FRAME_POSITION: [number, number, number] = [0, 0.8, 4.0];
const CAMERA_POSITION: [number, number, number] = [0, 0.8, 2.5];

export const ArchiveDetailStandalone: FC<ArchiveDetailStandaloneProps> = ({ item }) => {
  useEffect(() => {
    sendGAEvent("archive_detail_view", { painting_id: item.id });
  }, [item.id]);

  return (
    <div
      className="flex h-screen flex-col lg:flex-row"
      style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
    >
      <Link
        href="/archive"
        className="fixed top-4 left-4 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all hover:scale-110 hover:bg-white/20"
        aria-label="Back to archive"
      >
        <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </Link>

      <div className="relative h-[50vh] w-full lg:h-full lg:w-[60%]">
        <Canvas
          frameloop="demand"
          shadows={false}
          dpr={[1, 1.5]}
          camera={{
            fov: 50,
            position: CAMERA_POSITION,
            near: 0.1,
            far: 100,
          }}
          gl={{
            antialias: true,
            stencil: false,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = ACESFilmicToneMapping;
            gl.setClearColor("#050505");
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <Lights disableDevControls />
          <GalleryRoom />
          <Suspense fallback={null}>
            <ArchiveFramedPainting item={item} framePosition={DETAIL_FRAME_POSITION} />
          </Suspense>
        </Canvas>
      </div>

      <div className="flex h-[50vh] flex-col overflow-y-auto bg-black/80 p-6 lg:h-full lg:w-[40%] lg:bg-black/60">
        <ArchiveMetadataPanel item={item} />
      </div>
    </div>
  );
};
