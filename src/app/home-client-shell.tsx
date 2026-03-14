"use client";

import type { PaintingMetadata } from "@/types/paintings";
import dynamic from "next/dynamic";
import type { FC } from "react";

const DynamicHomeClient = dynamic(async () => import("./home-client"), {
  ssr: false,
});

interface HomeClientShellProps {
  initialPainting?: PaintingMetadata | null;
}

export const HomeClientShell: FC<HomeClientShellProps> = (props) => {
  return <DynamicHomeClient {...props} />;
};
