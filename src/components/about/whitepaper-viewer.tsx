"use client";

import React from "react";
import type { PropsWithChildren } from "react";

const WhitepaperViewer: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <div
      className="w-full h-full min-h-[110vh] bg-white p-0 m-0 font-serif leading-relaxed overflow-auto flex flex-col relative print:max-w-full print:p-[1in] print:shadow-none print:bg-white print:overflow-auto"
      data-scrollable="true"
    >
      {children}
    </div>
  );
};

export default WhitepaperViewer;
