"use client";

import React from "react";
import type { PropsWithChildren } from "react";
import styles from "./whitepaper-viewer.module.css";

const WhitepaperViewer: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <div className={styles.container} data-scrollable="true">
      {children}
    </div>
  );
};

export default WhitepaperViewer;
