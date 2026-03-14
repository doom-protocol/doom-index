"use client";

import { getImageUrlForContext } from "@/lib/cloudflare-image";
import { buildSizesAttr } from "@/types/domain";
import type { ResponsiveSizes } from "@/types/domain";
import type { ImagePreset } from "@/lib/cloudflare-image";
import { logger } from "@/utils/logger";
import Image from "next/image";
import { useState } from "react";
import type { FC, ReactNode, SyntheticEvent } from "react";

interface ProgressiveImageProps {
  src: string;
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
  imagePreset?: ImagePreset;
}

/**
 * Progressive Image Component
 *
 * A reusable image component with loading and error states.
 * Provides automatic logging for debugging and monitoring.
 */
export const ProgressiveImage: FC<ProgressiveImageProps> = ({
  src,
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
  imagePreset,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isRemoteSource = src.startsWith("http://") || src.startsWith("https://");
  const displaySrc = imagePreset ? getImageUrlForContext(src, imagePreset) : src;

  const handleImageLoad = () => {
    logger.debug("progressive-image.loaded", {
      src: displaySrc,
      originalSrc: src,
      ...(logContext ?? {}),
    });
    setIsLoading(false);
    onLoad?.();
  };

  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    logger.error("progressive-image.failed", {
      src: displaySrc,
      originalSrc: src,
      error: event,
      ...(logContext ?? {}),
    });
    setIsLoading(false);
    setHasError(true);
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
        src={displaySrc}
        alt={alt}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        sizes={buildSizesAttr(sizes)}
        loading={loading}
        unoptimized={isRemoteSource}
        className={`${className} ${isLoading ? "opacity-0" : "opacity-100"}`}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </>
  );
};
