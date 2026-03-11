"use client";

import { viewerCountStore } from "@/lib/viewer-count-store";
import { useSyncExternalStore } from "react";

const EMPTY_VIEWER_COUNT_STATE = {
  count: null,
  updatedAt: null,
} as const;

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
    () => EMPTY_VIEWER_COUNT_STATE,
  );

  return {
    count: state.count,
    updatedAt: state.updatedAt,
  };
}
