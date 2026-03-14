"use client";

import { viewerCountStore } from "@/lib/viewer-count-store";
import { logger } from "@/utils/logger";
import { useEffect, useRef } from "react";

interface ViewerCountMessage {
  type: "viewer-count";
  count: number;
  updatedAt: number;
}

function isViewerCountMessage(data: unknown): data is ViewerCountMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "viewer-count" &&
    "count" in data &&
    typeof data.count === "number" &&
    "updatedAt" in data &&
    typeof data.updatedAt === "number"
  );
}

export function useViewer(): null {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    logger.debug("viewer.start");

    const handleError = (event: ErrorEvent) => {
      logger.error("viewer.worker.error", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error instanceof Error ? event.error.message : String(event.error),
      });
    };

    const handleMessage = (event: MessageEvent<unknown>) => {
      const data = event.data;

      if (isViewerCountMessage(data)) {
        logger.debug("viewer.count-update", { count: data.count });
        viewerCountStore.update(data.count, data.updatedAt);
      }
    };

    let w: Worker | null = null;
    try {
      // Start Web Worker which handles WebSocket connection and Heartbeat
      w = new Worker(new URL("../workers/viewer.worker.ts", import.meta.url));
      workerRef.current = w;

      w.addEventListener("error", handleError);
      w.addEventListener("message", handleMessage);

      logger.debug("viewer.started");
    } catch (error) {
      logger.error("viewer.start.failed", { error });
      return; // Early return if worker creation failed
    }

    // cleanup
    return () => {
      w.removeEventListener("error", handleError);
      w.removeEventListener("message", handleMessage);
      logger.debug("viewer.terminate");
      w.terminate();
      workerRef.current = null;
    };
  }, []); // dependency array is empty (only run once on mount)

  return null;
}
