"use client";

import { useEffect, useState, type DependencyList } from "react";

const EMPTY_DEPS: DependencyList = [];

/**
 * Generic hook for browser detection
 *
 * @param detector - Function that detects browser environment (returns true/false)
 * @param deps - useEffect dependency array (used when listener registration is needed)
 * @returns {boolean} true if detector returns true, false otherwise
 */
function useBrowserDetection(detector: () => boolean, deps: DependencyList = EMPTY_DEPS): boolean {
  const [result, setResult] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const check = () => {
      const detected = detector();
      if (detected !== result) {
        setResult(detected);
      }
    };

    check();

    // Register listener only if deps is not empty (for resize, etc.)
    if (deps.length > 0) {
      window.addEventListener("resize", check);
      return () => {
        window.removeEventListener("resize", check);
      };
    }
    return undefined;
  }, [deps, detector, result]);

  return result ?? false;
}

/**
 * Custom hook to determine if the device is mobile
 * Checks window size and presence of touch events
 *
 * @returns {boolean} true if mobile device, false otherwise
 */
export const useMobile = (): boolean => {
  return useBrowserDetection(
    () => window.innerWidth < 768 || "ontouchstart" in window,
    [], // Pass empty array to monitor resize events (determined by deps.length check)
  );
};

/**
 * Custom hook to determine if the device is iOS (WebKit)
 *
 * @returns {boolean} true if iOS device, false otherwise
 */
export const useIOS = (): boolean => {
  return useBrowserDetection(() => {
    if (typeof navigator === "undefined") {
      return false;
    }
    const ua = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  });
};
