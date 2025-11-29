"use client";

import { useEffect, useRef, useState } from "react";
import { DataTexture, RGBAFormat, TextureLoader, UnsignedByteType, type Texture } from "three";
import { logger } from "@/utils/logger";

// ============================================================================
// Types
// ============================================================================

export type UseSafeTextureOptions = {
  /** TextureLoader.setCrossOrigin value. Default "anonymous" */
  crossOrigin?: string;
  /** Called when texture is loaded */
  onLoad?: (texture: Texture | Texture[] | Record<string, Texture>) => void;
  /** Called when error occurs */
  onError?: (error: Error) => void;
};

// ============================================================================
// Helpers
// ============================================================================

/** Create a reusable black 1x1 texture for fallback */
let _fallbackTexture: Texture | null = null;
function getFallbackTexture(): Texture {
  if (!_fallbackTexture) {
    const data = new Uint8Array([0, 0, 0, 255]); // Black opaque
    _fallbackTexture = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType);
    _fallbackTexture.needsUpdate = true;
    _fallbackTexture.name = "fallback_black";
  }
  return _fallbackTexture;
}

// ============================================================================
// Implementation
// ============================================================================

export function useSafeTexture(
  input: string | string[] | Record<string, string>,
  optionsOrCallback?: UseSafeTextureOptions | ((texture: Texture | Texture[] | Record<string, Texture>) => void),
): Texture | Texture[] | Record<string, Texture> {
  // Parse options
  const isCallback = typeof optionsOrCallback === "function";
  const options = isCallback ? {} : (optionsOrCallback ?? {});
  const onLoad = isCallback ? optionsOrCallback : options.onLoad;
  const { crossOrigin = "anonymous", onError } = options;

  // Helper to get fallback based on input shape
  const getFallback = (): Texture | Texture[] | Record<string, Texture> => {
    const fallback = getFallbackTexture();
    if (Array.isArray(input)) {
      return input.map(() => fallback);
    }
    if (typeof input === "object" && input !== null) {
      const fallbackObj: Record<string, Texture> = {};
      Object.keys(input).forEach(k => (fallbackObj[k] = fallback));
      return fallbackObj;
    }
    return fallback;
  };

  // Initialize with fallback texture immediately to prevent null/white screen
  const [result, setResult] = useState<Texture | Texture[] | Record<string, Texture>>(getFallback);

  // Refs for callbacks to prevent useEffect re-triggering
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Stable input key to prevent re-loading on every render if object/array is passed inline
  const inputKey = typeof input === "string" ? input : JSON.stringify(input);

  useEffect(() => {
    const loader = new TextureLoader();
    if (crossOrigin) {
      loader.setCrossOrigin(crossOrigin);
    }

    let mounted = true;

    const loadTexture = (url: string): Promise<Texture> => {
      return new Promise((resolve, reject) => {
        loader.load(
          url,
          tex => resolve(tex),
          undefined,
          err => reject(err),
        );
      });
    };

    const load = async () => {
      try {
        let data: Texture | Texture[] | Record<string, Texture>;

        if (Array.isArray(input)) {
          data = await Promise.all(input.map(url => loadTexture(url)));
        } else if (typeof input === "object" && input !== null) {
          const keys = Object.keys(input);
          const textures = await Promise.all(keys.map(key => loadTexture(input[key])));
          data = {};
          keys.forEach((key, i) => {
            (data as Record<string, Texture>)[key] = textures[i];
          });
        } else {
          data = await loadTexture(input as string);
        }

        if (mounted) {
          setResult(data);
          onLoadRef.current?.(data);
        }
      } catch (err) {
        if (mounted) {
          const error = err instanceof Error ? err : new Error(String(err));
          logger.error("[useSafeTexture] Load failed", { error: error.message });
          onErrorRef.current?.(error);

          // Even on error, ensure we have a fallback (though state might already be fallback)
          setResult(getFallback());
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, crossOrigin]);

  return result;
}
