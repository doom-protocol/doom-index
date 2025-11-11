"use client";

import { useEffect, useRef } from "react";

export function useViewer() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // start Web Worker (sessionId generation and heartbeat sending are automatically started in the Worker)
    const w = new Worker(new URL("@/workers/viewer.worker", import.meta.url), { type: "module" });
    workerRef.current = w;

    // handle page unload (terminate Worker)
    const onUnload = () => {
      if (w) {
        w.terminate();
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
