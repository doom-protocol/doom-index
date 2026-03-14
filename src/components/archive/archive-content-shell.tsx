"use client";

import type { Painting } from "@/types/paintings";
import dynamic from "next/dynamic";
import type { FC } from "react";

const DynamicArchiveContent = dynamic(
  async () =>
    import("./archive-content").then((mod) => ({
      default: mod.ArchiveContent,
    })),
  {
    ssr: false,
  },
);

interface ArchiveContentShellProps {
  items: Painting[];
  hasNextPage: boolean;
  page: number;
  from?: string;
  to?: string;
}

export const ArchiveContentShell: FC<ArchiveContentShellProps> = (props) => {
  return <DynamicArchiveContent {...props} />;
};
