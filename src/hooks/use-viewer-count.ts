"use client";

import { useSyncExternalStore } from "react";
import { viewerCountStore } from "@/lib/viewer-count-store";

/**
 * Hook to get the current viewer count from the store
 * Updates automatically when the store receives new data from the worker
 */
export function useViewerCount(): {
  count: number | null;
  updatedAt: number | null;
} {
  const state = useSyncExternalStore(
    viewerCountStore.subscribe.bind(viewerCountStore),
    viewerCountStore.getSnapshot.bind(viewerCountStore),
    () => ({ count: null, updatedAt: null }), // getServerSnapshot for SSR
  );

  return {
    count: state.count,
    updatedAt: state.updatedAt,
  };
}
