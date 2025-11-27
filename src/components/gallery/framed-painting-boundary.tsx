"use client";

import { Sentry } from "@/lib/sentry";
import { logger } from "@/utils/logger";
import React, { Suspense } from "react";
import type { Group } from "three";
import { FramedPainting } from "./framed-painting";

const FALLBACK_THUMBNAIL = "/placeholder-painting.webp";

interface FramedPaintingBoundaryProps {
  thumbnailUrl: string;
  paintingId?: string;
  innerRef: React.Ref<Group>;
}

export function FramedPaintingErrorBoundary({
  thumbnailUrl,
  paintingId,
  innerRef,
}: FramedPaintingBoundaryProps) {
  return (
    <Sentry.ErrorBoundary
      resetKeys={[thumbnailUrl]}
      onError={(error, componentStack) => {
        logger.error("framed-painting.error", {
          error,
          componentStack,
          thumbnailUrl,
          paintingId,
        });
      }}
      fallback={
        <Suspense fallback={null}>
          <FramedPainting ref={innerRef} thumbnailUrl={FALLBACK_THUMBNAIL} paintingId={undefined} />
        </Suspense>
      }
    >
      <Suspense fallback={null}>
        <FramedPainting ref={innerRef} thumbnailUrl={thumbnailUrl} paintingId={paintingId} />
      </Suspense>
    </Sentry.ErrorBoundary>
  );
}
