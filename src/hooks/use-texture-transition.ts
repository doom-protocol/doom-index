"use client";

import { useSafeTexture } from "@/hooks/use-safe-texture";
import { logger } from "@/utils/logger";
import { useEffect, useRef, useState } from "react";
import { SRGBColorSpace, type Texture } from "three";

export interface TextureTransitionState {
  /** Current active texture for rendering */
  currentTexture: Texture;
  /** Previous texture (shown during transition) */
  previousTexture: Texture | null;
  /** Whether a transition is currently active */
  isTransitionActive: boolean;
  /** Ref to track previous texture for cleanup */
  previousTextureRef: React.MutableRefObject<Texture | null>;
  /** Ref to track transition elapsed time */
  transitionElapsedRef: React.MutableRefObject<number>;
  /** Function to mark transition as complete */
  completeTransition: () => void;
  /** The raw texture from useSafeTexture (for fallback) */
  rawTexture: Texture;
}

export interface UseTextureTransitionOptions {
  /** Component name for error logging */
  componentName?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Hook for managing texture transitions with crossfade effect.
 * Suspense-compatible - will suspend while texture is loading.
 * Handles URL changes, texture loading, and cleanup.
 */
export function useTextureTransition(
  thumbnailUrl: string,
  options: UseTextureTransitionOptions = {},
): TextureTransitionState {
  const { componentName = "PaintingContent", debug = process.env.NODE_ENV === "development" } = options;

  // Build texture URL with threejs=true parameter for R2 route access
  const textureUrl = `${thumbnailUrl}${thumbnailUrl.includes("?") ? "&" : "?"}threejs=true`;

  // Load texture with useSafeTexture (Suspense-compatible - throws Promise while loading)
  // Single URL always returns Texture (not array or object)
  const texture = useSafeTexture(textureUrl, (loadedTexture: Texture) => {
    loadedTexture.colorSpace = SRGBColorSpace;
    loadedTexture.anisotropy = 4;
    loadedTexture.needsUpdate = true;

    if (debug) {
      logger.debug(`[${componentName}] Texture loaded successfully:`, { url: textureUrl });
    }
  });

  // Transition state
  const [currentTexture, setCurrentTexture] = useState<Texture>(texture);
  const [previousTexture, setPreviousTexture] = useState<Texture | null>(null);
  const [isTransitionActive, setIsTransitionActive] = useState(false);

  // Refs for tracking state across renders
  const transitionElapsedRef = useRef(0);
  const previousTextureRef = useRef<Texture | null>(null);
  const currentTextureRef = useRef<Texture>(texture);
  const previousUrlRef = useRef<string>(textureUrl);

  // Handle texture changes (when URL changes and new texture loads)
  useEffect(() => {
    // Skip if same texture reference
    if (texture === currentTextureRef.current) return;

    // Skip if same URL (texture reference might change due to cache)
    if (textureUrl === previousUrlRef.current && texture.image === currentTextureRef.current.image) return;

    // Start transition from old to new texture
    const oldTexture = currentTextureRef.current;
    previousTextureRef.current = oldTexture;
    setPreviousTexture(oldTexture);

    currentTextureRef.current = texture;
    setCurrentTexture(texture);
    previousUrlRef.current = textureUrl;

    transitionElapsedRef.current = 0;
    setIsTransitionActive(true);
  }, [texture, textureUrl]);

  // Cleanup textures on unmount
  useEffect(() => {
    return () => {
      // Don't dispose cached textures - they're managed by useSafeTexture cache
    };
  }, []);

  // Function to mark transition as complete
  const completeTransition = () => {
    setIsTransitionActive(false);
    previousTextureRef.current = null;
    setPreviousTexture(null);
    // Don't dispose - textures are cached and may be reused
  };

  return {
    currentTexture,
    previousTexture,
    isTransitionActive,
    previousTextureRef,
    transitionElapsedRef,
    completeTransition,
    rawTexture: texture,
  };
}
