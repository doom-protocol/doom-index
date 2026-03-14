"use client";

import { buildSizesAttr } from "@/types/domain";
import type { ResponsiveSizes } from "@/types/domain";
import { logger } from "@/utils/logger";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { FC, ReactNode, SyntheticEvent } from "react";

interface ProgressiveImageProps {
  src: string;
  sources?: string[];
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: ResponsiveSizes;
  loading?: "eager" | "lazy";
  onLoad?: () => void;
  onError?: (error: SyntheticEvent<HTMLImageElement>) => void;
  fallback?: ReactNode;
  skeleton?: ReactNode;
  logContext?: Record<string, unknown>;
}

/**
 * Progressive Image Component
 *
 * A reusable image component with loading and error states.
 * Provides automatic logging for debugging and monitoring.
 */
export const ProgressiveImage: FC<ProgressiveImageProps> = ({
  src,
  sources,
  alt,
  className = "",
  fill = false,
  width,
  height,
  sizes,
  loading,
  onLoad,
  onError,
  fallback,
  skeleton,
  logContext,
}) => {
  const candidateSources = useMemo(() => {
    if (sources && sources.length > 0) {
      return sources;
    }

    return [src];
  }, [sources, src]);
  const sourceKey = candidateSources.join("\n");
  const [imageState, setImageState] = useState({
    currentSourceIndex: 0,
    hasError: false,
    isLoading: true,
    sourceKey,
  });
  const currentSourceIndex = imageState.sourceKey === sourceKey ? imageState.currentSourceIndex : 0;
  const hasError = imageState.sourceKey === sourceKey ? imageState.hasError : false;
  const isLoading = imageState.sourceKey === sourceKey ? imageState.isLoading : true;
  const currentSrc = candidateSources[currentSourceIndex] ?? src;

  const handleImageLoad = () => {
    logger.debug("progressive-image.loaded", {
      src: currentSrc,
      ...(logContext ?? {}),
    });
    setImageState((previousState) => ({
      ...previousState,
      hasError: false,
      isLoading: false,
      sourceKey,
    }));
    onLoad?.();
  };

  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    const nextSourceIndex = currentSourceIndex + 1;
    const nextSrc = candidateSources[nextSourceIndex];

    if (nextSrc) {
      logger.warn("progressive-image.retry", {
        failedSrc: currentSrc,
        nextSrc,
        ...(logContext ?? {}),
      });
      setImageState({
        currentSourceIndex: nextSourceIndex,
        hasError: false,
        isLoading: true,
        sourceKey,
      });
      return;
    }

    logger.error("progressive-image.failed", {
      src: currentSrc,
      error: event,
      ...(logContext ?? {}),
    });
    setImageState({
      currentSourceIndex,
      hasError: true,
      isLoading: false,
      sourceKey,
    });
    onError?.(event);
  };

  if (hasError) {
    return (
      <>
        {fallback ?? (
          <div className="flex h-full w-full items-center justify-center bg-black/40">
            <span className="text-xs text-white/50">Failed to load</span>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {isLoading && skeleton && <div className="absolute inset-0 z-10">{skeleton}</div>}
      <Image
        key={currentSrc}
        src={currentSrc}
        alt={alt}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        sizes={buildSizesAttr(sizes)}
        loading={loading}
        className={`${className} ${isLoading ? "opacity-0" : "opacity-100"}`}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </>
  );
};
