"use client";

import { viewerCountStore } from "@/lib/viewer-count-store";
import { logger } from "@/utils/logger";
import { useEffect, useRef } from "react";

type ViewerCountMessage = {
  type: "viewer-count";
  count: number;
  updatedAt: number;
};

export function useViewer() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    logger.debug("viewer.start");

    let w: Worker | null = null;
    try {
      // Start Web Worker which handles WebSocket connection and Heartbeat
      w = new Worker(new URL("@/workers/viewer.worker", import.meta.url));
      workerRef.current = w;

      // Add error handler to catch Worker errors
      w.addEventListener("error", event => {
        logger.error("viewer.worker.error", {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        });
      });

      // Add message handler for viewer count updates from WebSocket via Worker
      w.addEventListener("message", event => {
        const data = event.data;

        // Handle viewer count updates
        if (data && typeof data === "object" && "type" in data && data.type === "viewer-count") {
          const message = data as ViewerCountMessage;
          console.log("[useViewer] Received count update from worker:", message.count);
          viewerCountStore.update(message.count, message.updatedAt);
        }
      });

      logger.debug("viewer.started");
    } catch (error) {
      logger.error("viewer.start.failed", { error });
      return; // Early return if worker creation failed
    }

    // cleanup
    return () => {
      const worker = workerRef.current;
      if (worker) {
        logger.debug("viewer.terminate");
        worker.terminate();
        workerRef.current = null;
      }
    };
  }, []); // dependency array is empty (only run once on mount)

  return null;
}
