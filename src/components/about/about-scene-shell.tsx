"use client";

import dynamic from "next/dynamic";
import type { FC, PropsWithChildren } from "react";

const DynamicAboutScene = dynamic(
  async () =>
    import("./about-scene").then((mod) => ({
      default: mod.AboutScene,
    })),
  {
    ssr: false,
  },
);

export const AboutSceneShell: FC<PropsWithChildren> = ({ children }) => {
  return <DynamicAboutScene>{children}</DynamicAboutScene>;
};
