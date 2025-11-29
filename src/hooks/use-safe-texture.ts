"use client";

import { useTexture } from "@react-three/drei";

type UseSafeTextureOptions = {
  /** TextureLoader.setCrossOrigin value. Default "anonymous" */
  crossOrigin?: "anonymous" | "use-credentials" | "";
  /** Transform URL if needed */
  transformUrl?: (url: string) => string;
  /** Called when texture is loaded */
  onLoad?: (texture: any) => void;
  /** Called when error occurs */
  onError?: (error: Error, url: string) => void;
  /** Enable debug logging */
  debug?: boolean;
};

// Simple wrapper around useTexture with error handling and backward compatibility
export function useSafeTexture(
  input: string | string[] | Record<string, string>,
  optionsOrCallback?: UseSafeTextureOptions | ((texture: any) => void),
) {
  const isCallback = typeof optionsOrCallback === 'function';
  const options = isCallback ? {} : (optionsOrCallback || {});
  const callback = isCallback ? optionsOrCallback : options.onLoad;

  const { transformUrl, onError, debug = process.env.NODE_ENV === 'development' } = options;

  // Transform URLs if needed
  let processedInput = input;
  if (typeof input === 'string' && transformUrl) {
    processedInput = transformUrl(input);
  } else if (Array.isArray(input) && transformUrl) {
    processedInput = input.map(url => transformUrl(url));
  } else if (typeof input === 'object' && input !== null && !Array.isArray(input) && transformUrl) {
    processedInput = Object.fromEntries(
      Object.entries(input).map(([key, url]) => [key, transformUrl(url)])
    );
  }

  // Create enhanced callback that includes error handling
  const enhancedCallback = (texture: any) => {
    try {
      callback?.(texture);
      if (debug) {
        console.log('[useSafeTexture] Loaded:', processedInput);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (debug) {
        console.error('[useSafeTexture] Callback error:', err, 'Input:', input);
      }
      onError?.(err, typeof input === 'string' ? input : JSON.stringify(input));
    }
  };

  // Use original useTexture
  try {
    return useTexture(processedInput, enhancedCallback);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (debug) {
      console.error('[useSafeTexture] Error:', err, 'Input:', input);
    }
    onError?.(err, typeof input === 'string' ? input : JSON.stringify(input));
    return null;
  }
}