"use client";

import type { PropsWithChildren } from "react";
import { type FC } from "react";

const WhitepaperViewer: FC<PropsWithChildren> = ({ children }) => {
  return (
    <div
      className="relative m-0 flex h-full min-h-[110vh] w-full flex-col overflow-auto bg-white p-0 font-serif leading-relaxed print:max-w-full print:overflow-auto print:bg-white print:p-[1in] print:shadow-none"
      data-scrollable="true"
    >
      {children}
    </div>
  );
};

export default WhitepaperViewer;
