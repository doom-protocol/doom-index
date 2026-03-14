"use client";

import { useCallback } from "react";

const DEFAULT_HAPTIC_DURATION_MS = 5;

export function useHapticFeedback(duration = DEFAULT_HAPTIC_DURATION_MS): {
  triggerHaptic: () => void;
} {
  const triggerHaptic = useCallback(() => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
      return;
    }

    navigator.vibrate(duration);
  }, [duration]);

  return { triggerHaptic };
}
