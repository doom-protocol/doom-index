import { logger } from "@/utils/logger";
import { useEffect, useMemo, useRef, useState } from "react";

interface UseImagePreloadResult {
  loadedCount: number;
  isComplete: boolean;
}

/**
 * Hook to preload images in the background
 * @param imageUrls Array of image URLs to preload
 * @returns Object with loadedCount and isComplete status
 */
export function useImagePreload(imageUrls: string[]): UseImagePreloadResult {
  const [, forceRender] = useState(0);
  const imageRefsRef = useRef<HTMLImageElement[]>([]);
  const progressRef = useRef<{ key: string; loadedCount: number; isComplete: boolean } | null>(null);

  const key = useMemo(() => JSON.stringify(imageUrls), [imageUrls]);

  // When URLs change, return the new key's default progress without needing setState.
  const defaultProgress: UseImagePreloadResult = {
    loadedCount: 0,
    isComplete: imageUrls.length === 0,
  };
  const currentProgress =
    progressRef.current && progressRef.current.key === key ? progressRef.current : { key, ...defaultProgress };

  useEffect(() => {
    // Clean up previous images
    imageRefsRef.current.forEach((img) => {
      img.onload = null;
      img.onerror = null;
    });
    imageRefsRef.current = [];

    if (imageUrls.length === 0) {
      return;
    }

    let completedCount = 0;
    const images: HTMLImageElement[] = [];
    let isActive = true;

    const handleLoad = (url: string) => () => {
      logger.debug("image.preload.loaded", { url });
      completedCount++;
      if (!isActive) return;
      const isComplete = completedCount === imageUrls.length;
      progressRef.current = { key, loadedCount: completedCount, isComplete };
      forceRender((v) => v + 1);
    };

    const handleError = (url: string) => (event: Event | string) => {
      const errorDetails =
        event instanceof Event && event.target instanceof HTMLImageElement
          ? {
              url,
              naturalWidth: event.target.naturalWidth,
              naturalHeight: event.target.naturalHeight,
              currentSrc: event.target.currentSrc,
              src: event.target.src,
              complete: event.target.complete,
            }
          : { url, event: event instanceof Error ? event.message : JSON.stringify(event) };
      logger.debug("image.preload.failed", errorDetails);
      completedCount++;
      if (!isActive) return;
      const isComplete = completedCount === imageUrls.length;
      progressRef.current = { key, loadedCount: completedCount, isComplete };
      forceRender((v) => v + 1);
    };

    // Preload all images
    logger.debug("image.preload.start", {
      urlCount: imageUrls.length,
      urls: imageUrls,
    });

    imageUrls.forEach((url) => {
      const img = new Image();
      img.onload = handleLoad(url);
      img.onerror = handleError(url);
      img.src = url;
      images.push(img);
    });

    imageRefsRef.current = images;

    return () => {
      isActive = false;
      // Cleanup: remove event listeners
      images.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, [imageUrls, key]);

  return { loadedCount: currentProgress.loadedCount, isComplete: currentProgress.isComplete };
}
