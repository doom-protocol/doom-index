"use client";

import { useEffect, useRef } from "react";
import { logger } from "@/utils/logger";

export function useViewer() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    logger.debug("viewer.start");

    let w: Worker | null = null;
    try {
      // start Web Worker (sessionId generation and heartbeat sending are automatically started in the Worker)
      w = new Worker(new URL("@/workers/viewer.worker", import.meta.url), { type: "module" });
      workerRef.current = w;

      // Add error handler to catch Worker errors
      w.addEventListener("error", event => {
        logger.debug("viewer.worker.error", {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        });
      });

      // Add message handler for debugging
      w.addEventListener("message", event => {
        logger.debug("viewer.worker.message", event.data);
      });

      logger.debug("viewer.started");
    } catch (error) {
      logger.debug("viewer.start.failed", { error });
      return; // Early return if worker creation failed
    }

    // handle page unload (terminate Worker)
    const onUnload = () => {
      const worker = workerRef.current;
      if (worker) {
        logger.debug("viewer.terminate");
        worker.terminate();
        workerRef.current = null;
      }
    };

    // watch page unload events
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);

    // cleanup
    return () => {
      onUnload();
      workerRef.current = null;
    };
  }, []); // dependency array is empty (only run once on mount)
}
