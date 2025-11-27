"use client";

import { reportClientError } from "@/lib/client-error-reporter";
import { logger } from "@/utils/logger";
import React, { Suspense, type ErrorInfo, type ReactNode } from "react";
import type { Group } from "three";
import { FramedPainting } from "./framed-painting";

const FALLBACK_THUMBNAIL = "/placeholder-painting.webp";

interface FramedPaintingBoundaryProps {
  thumbnailUrl: string;
  paintingId?: string;
  innerRef: React.Ref<Group>;
}

interface State {
  hasError: boolean;
}

export class FramedPaintingErrorBoundary extends React.Component<FramedPaintingBoundaryProps, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const { thumbnailUrl, paintingId } = this.props;

    logger.error("framed-painting.error", {
      error,
      componentStack: info.componentStack,
      thumbnailUrl,
      paintingId,
    });

    void reportClientError({
      error,
      context: "FramedPainting",
      componentStack: info.componentStack ?? undefined,
      extra: {
        thumbnailUrl,
        paintingId,
      },
    });
  }

  componentDidUpdate(prevProps: FramedPaintingBoundaryProps): void {
    if (this.state.hasError && prevProps.thumbnailUrl !== this.props.thumbnailUrl) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    const { thumbnailUrl, paintingId, innerRef } = this.props;

    if (this.state.hasError) {
      return (
        <Suspense fallback={null}>
          <FramedPainting ref={innerRef} thumbnailUrl={FALLBACK_THUMBNAIL} paintingId={undefined} />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={null}>
        <FramedPainting ref={innerRef} thumbnailUrl={thumbnailUrl} paintingId={paintingId} />
      </Suspense>
    );
  }
}
