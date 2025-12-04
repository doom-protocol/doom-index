"use client";

import { logger } from "@/utils/logger";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error Boundary for Three.js components
 * Catches errors in the component tree (like texture loading failures)
 * and displays a fallback UI instead of crashing the canvas.
 */
export class ThreeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error("three-error-boundary.caught", {
      error: error instanceof Error ? error.message : String(error),
      componentStack: errorInfo.componentStack,
    });
  }

  // Reset error state when children change (e.g. URL changes)
  componentDidUpdate(prevProps: Props): void {
    if (this.props.children !== prevProps.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}
