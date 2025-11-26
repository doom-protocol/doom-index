"use client";

import { logger } from "@/utils/logger";
import Image from "next/image";
import React, { useState } from "react";

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  onLoad?: () => void;
  onError?: (error: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  fallback?: React.ReactNode;
  skeleton?: React.ReactNode;
  logContext?: Record<string, unknown>;
}

/**
 * Progressive Image Component
 *
 * A reusable image component with loading and error states.
 * Provides automatic logging for debugging and monitoring.
 */
export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className = "",
  fill = false,
  width,
  height,
  priority = false,
  onLoad,
  onError,
  fallback,
  skeleton,
  logContext = {},
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleImageLoad = () => {
    logger.debug("progressive-image.loaded", {
      src,
      ...logContext,
    });
    setIsLoading(false);
    onLoad?.();
  };

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    logger.error("progressive-image.failed", {
      src,
      error: event,
      ...logContext,
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
        src={src}
        alt={alt}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        priority={priority}
        className={`${className} ${isLoading ? "opacity-0" : "opacity-100"}`}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </>
  );
};
