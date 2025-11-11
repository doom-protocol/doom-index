"use client";

import { useEffect, useRef } from "react";

export function useViewer() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    console.debug("[useViewer] Starting viewer worker");

    let w: Worker | null = null;
    try {
      // start Web Worker (sessionId generation and heartbeat sending are automatically started in the Worker)
      w = new Worker(new URL("@/workers/viewer.worker", import.meta.url), { type: "module" });
      workerRef.current = w;

      // Add error handler to catch Worker errors
      w.addEventListener("error", event => {
        console.error("[useViewer] Worker error", {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        });
      });

      // Add message handler for debugging
      w.addEventListener("message", event => {
        console.debug("[useViewer] Worker message", event.data);
      });

      console.debug("[useViewer] Worker started successfully");
    } catch (error) {
      console.error("[useViewer] Failed to start worker", error);
      return; // Early return if worker creation failed
    }

    // handle page unload (terminate Worker)
    const onUnload = () => {
      const worker = workerRef.current;
      if (worker) {
        console.debug("[useViewer] Terminating worker");
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
