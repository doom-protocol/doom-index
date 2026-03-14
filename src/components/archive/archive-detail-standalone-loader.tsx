"use client";

import type { Painting } from "@/types/paintings";
import dynamic from "next/dynamic";
import type { FC } from "react";

const ArchiveDetailStandalone = dynamic(
  async () => import("./archive-detail-standalone").then((mod) => mod.ArchiveDetailStandalone),
  { ssr: false },
);

interface Props {
  item: Painting;
}

export const ArchiveDetailStandaloneLoader: FC<Props> = ({ item }) => {
  return <ArchiveDetailStandalone item={item} />;
};
