"use client";

import { useSafeTexture } from "@/hooks/use-safe-texture";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SRGBColorSpace, type Texture } from "three";

export interface TextureTransitionState {
  /** Current active texture for rendering */
  currentTexture: Texture | null;
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
  rawTexture: Texture | null;
}

export interface UseTextureTransitionOptions {
  /** Component name for error logging */
  componentName?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Hook for managing texture transitions with crossfade effect.
 * Handles URL changes, texture loading, and cleanup.
 */
export function useTextureTransition(
  thumbnailUrl: string,
  options: UseTextureTransitionOptions = {},
): TextureTransitionState {
  const { componentName = "PaintingContent", debug = process.env.NODE_ENV === "development" } = options;

  // Build texture URL with threejs=true parameter for R2 route access
  const textureUrl = `${thumbnailUrl}${thumbnailUrl.includes("?") ? "&" : "?"}threejs=true`;

  // Load texture with useSafeTexture
  const texture = useSafeTexture(textureUrl, {
    onLoad: (loadedTexture: Texture) => {
      loadedTexture.colorSpace = SRGBColorSpace;
      loadedTexture.anisotropy = 4;
      loadedTexture.needsUpdate = true;
    },
    onError: (error, url) => {
      if (debug) {
        console.error(`[${componentName}] Texture load error:`, url, error);
      }
    },
    debug,
  }) as Texture | null;

  // Transition state
  const [currentTexture, setCurrentTexture] = useState<Texture | null>(texture);
  const [previousTexture, setPreviousTexture] = useState<Texture | null>(null);
  const [isTransitionActive, setIsTransitionActive] = useState(false);

  // Refs for tracking state across renders
  const previousThumbnailUrlRef = useRef<string | null>(thumbnailUrl);
  const transitionElapsedRef = useRef(0);
  const previousTextureRef = useRef<Texture | null>(null);
  const currentTextureRef = useRef<Texture | null>(texture);
  const pendingUrlRef = useRef<string | null>(null);

  // Handle thumbnailUrl changes - prepare for transition
  useLayoutEffect(() => {
    if (previousThumbnailUrlRef.current !== thumbnailUrl) {
      pendingUrlRef.current = thumbnailUrl;
      previousThumbnailUrlRef.current = thumbnailUrl;

      // If texture is already loaded and different, start transition immediately
      if (texture && currentTextureRef.current && texture !== currentTextureRef.current) {
        const oldTexture = currentTextureRef.current;
        previousTextureRef.current = oldTexture;
        setPreviousTexture(oldTexture);
        currentTextureRef.current = texture;
        setCurrentTexture(texture);
        transitionElapsedRef.current = 0;
        setIsTransitionActive(true);
        pendingUrlRef.current = null;
      }
    }
  }, [thumbnailUrl, texture]);

  // Watch for texture.image loading to catch when new texture is ready
  useEffect(() => {
    if (!texture?.image) {
      return;
    }

    const image = texture.image as HTMLImageElement;
    const imageSrc = image.src || image.currentSrc || "";

    // If we have a pending URL, check if this texture matches it
    if (pendingUrlRef.current) {
      if (imageSrc && imageSrc.includes(pendingUrlRef.current)) {
        const oldTexture = currentTextureRef.current;
        if (oldTexture && oldTexture !== texture) {
          previousTextureRef.current = oldTexture;
          setPreviousTexture(oldTexture);
        }

        currentTextureRef.current = texture;
        setCurrentTexture(texture);
        transitionElapsedRef.current = 0;
        setIsTransitionActive(true);
        pendingUrlRef.current = null;
        return;
      }
    }

    // Also check if texture reference changed
    if (currentTextureRef.current !== texture && texture.image) {
      const currentImage = currentTextureRef.current?.image as HTMLImageElement | undefined;
      const currentImageSrc = currentImage?.src || currentImage?.currentSrc || "";

      // If image source is different, this is a new texture
      if (imageSrc && imageSrc !== currentImageSrc) {
        const oldTexture = currentTextureRef.current;
        if (oldTexture) {
          previousTextureRef.current = oldTexture;
          setPreviousTexture(oldTexture);
        }

        currentTextureRef.current = texture;
        setCurrentTexture(texture);
        transitionElapsedRef.current = 0;
        setIsTransitionActive(true);
      }
    }
  }, [texture]);

  // Cleanup textures on unmount
  useEffect(() => {
    return () => {
      if (previousTextureRef.current) {
        previousTextureRef.current.dispose();
      }
      if (currentTexture && currentTexture !== texture) {
        currentTexture.dispose();
      }
    };
  }, [currentTexture, texture]);

  // Function to mark transition as complete
  const completeTransition = () => {
    setIsTransitionActive(false);
    const textureToDispose = previousTextureRef.current;
    previousTextureRef.current = null;
    setPreviousTexture(null);

    // Clean up previous texture
    if (textureToDispose) {
      textureToDispose.dispose();
    }
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
