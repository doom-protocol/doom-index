import { useEffect, useState, useRef } from "react";
import { logger } from "@/utils/logger";

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
  const [loadedCount, setLoadedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const imageRefsRef = useRef<HTMLImageElement[]>([]);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    // Reset state when URLs change
    if (JSON.stringify(urlsRef.current) !== JSON.stringify(imageUrls)) {
      setLoadedCount(0);
      setIsComplete(false);
      // Clean up previous images
      imageRefsRef.current.forEach(img => {
        img.onload = null;
        img.onerror = null;
      });
      imageRefsRef.current = [];
    }

    urlsRef.current = imageUrls;

    if (imageUrls.length === 0) {
      setIsComplete(true);
      return;
    }

    let completedCount = 0;
    const images: HTMLImageElement[] = [];

    const handleLoad = (url: string) => () => {
      logger.debug("image.preload.loaded", { url });
      completedCount++;
      setLoadedCount(completedCount);
      if (completedCount === imageUrls.length) {
        setIsComplete(true);
      }
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
          : { url, event: String(event) };
      logger.debug("image.preload.failed", errorDetails);
      completedCount++;
      setLoadedCount(completedCount);
      if (completedCount === imageUrls.length) {
        setIsComplete(true);
      }
    };

    // Preload all images
    logger.debug("image.preload.start", {
      urlCount: imageUrls.length,
      urls: imageUrls,
    });

    imageUrls.forEach(url => {
      const img = new Image();
      img.onload = handleLoad(url);
      img.onerror = handleError(url);
      img.src = url;
      images.push(img);
    });

    imageRefsRef.current = images;

    return () => {
      // Cleanup: remove event listeners
      images.forEach(img => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, [imageUrls]);

  return { loadedCount, isComplete };
}
