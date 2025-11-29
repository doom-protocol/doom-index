"use client";

import { useEffect, useMemo, useState } from "react";
import { TextureLoader, type Texture } from "three";

type UseSafeTextureOptions = {
  /** TextureLoader.setCrossOrigin value. Default "" (no CORS) */
  crossOrigin?: "anonymous" | "use-credentials" | "";
  /** Transform URL if needed */
  transformUrl?: (url: string) => string;
  /** Called when texture is loaded */
  onLoad?: (texture: Texture | Texture[]) => void;
  /** Called when error occurs */
  onError?: (error: Error, url: string) => void;
  /** Enable debug logging */
  debug?: boolean;
};

// Simple texture loader using THREE.TextureLoader directly with full control
export function useSafeTexture(
  input: string | string[] | Record<string, string>,
  optionsOrCallback?: UseSafeTextureOptions | ((texture: Texture | Texture[]) => void),
) {
  const isCallback = typeof optionsOrCallback === "function";
  const options = isCallback ? {} : optionsOrCallback || {};
  const callback = isCallback ? optionsOrCallback : options.onLoad;

  const { crossOrigin = "", transformUrl, onError, debug = process.env.NODE_ENV === "development" } = options;

  // Transform URLs if needed
  const processedInput = useMemo(() => {
    if (typeof input === "string" && transformUrl) {
      return transformUrl(input);
    } else if (Array.isArray(input) && transformUrl) {
      return input.map(url => transformUrl(url));
    } else if (typeof input === "object" && input !== null && !Array.isArray(input) && transformUrl) {
      return Object.fromEntries(Object.entries(input).map(([key, url]) => [key, transformUrl(url)]));
    }
    return input;
  }, [input, transformUrl]);

  const [texture, setTexture] = useState<Texture | Texture[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!processedInput) {
      setTexture(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Create loader with crossOrigin setting
    const loader = new TextureLoader();
    if (crossOrigin) {
      loader.setCrossOrigin(crossOrigin);
    }

    // Handle different input types
    if (typeof processedInput === "string") {
      // Single texture
      loader.load(
        processedInput,
        loadedTexture => {
          setTexture(loadedTexture);
          setLoading(false);
          setError(null);

          try {
            callback?.(loadedTexture);
            if (debug) {
              console.log("[useSafeTexture] Loaded:", processedInput);
            }
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            if (debug) {
              console.error("[useSafeTexture] Callback error:", err, "Input:", input);
            }
            onError?.(err, processedInput);
          }
        },
        undefined,
        err => {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          setLoading(false);

          if (debug) {
            console.error("[useSafeTexture] Load error:", processedInput, error);
          }
          onError?.(error, processedInput);
        },
      );
    } else if (Array.isArray(processedInput)) {
      // Array of textures
      const loadedTextures: Texture[] = [];
      let loadedCount = 0;
      let hasError = false;

      processedInput.forEach((url, index) => {
        loader.load(
          url,
          loadedTexture => {
            loadedTextures[index] = loadedTexture;
            loadedCount++;

            if (loadedCount === processedInput.length && !hasError) {
              setTexture(loadedTextures);
              setLoading(false);
              setError(null);

              try {
                callback?.(loadedTextures);
                if (debug) {
                  console.log("[useSafeTexture] Loaded array:", processedInput.length, "textures");
                }
              } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                if (debug) {
                  console.error("[useSafeTexture] Callback error:", err, "Input:", input);
                }
                onError?.(err, JSON.stringify(processedInput));
              }
            }
          },
          undefined,
          err => {
            if (!hasError) {
              hasError = true;
              const error = err instanceof Error ? err : new Error(String(err));
              setError(error);
              setLoading(false);

              if (debug) {
                console.error("[useSafeTexture] Load error in array:", url, error);
              }
              onError?.(error, url);
            }
          },
        );
      });
    } else if (typeof processedInput === "object") {
      // Object of textures
      const loadedTextures: Record<string, Texture> = {};
      const entries = Object.entries(processedInput);
      let loadedCount = 0;
      let hasError = false;

      entries.forEach(([key, url]) => {
        loader.load(
          url,
          loadedTexture => {
            loadedTextures[key] = loadedTexture;
            loadedCount++;

            if (loadedCount === entries.length && !hasError) {
              setTexture(loadedTextures as any);
              setLoading(false);
              setError(null);

              try {
                callback?.(loadedTextures as any);
                if (debug) {
                  console.log("[useSafeTexture] Loaded object:", Object.keys(loadedTextures).length, "textures");
                }
              } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                if (debug) {
                  console.error("[useSafeTexture] Callback error:", err, "Input:", input);
                }
                onError?.(err, JSON.stringify(processedInput));
              }
            }
          },
          undefined,
          err => {
            if (!hasError) {
              hasError = true;
              const error = err instanceof Error ? err : new Error(String(err));
              setError(error);
              setLoading(false);

              if (debug) {
                console.error("[useSafeTexture] Load error in object:", key, url, error);
              }
              onError?.(error, url);
            }
          },
        );
      });
    }
  }, [processedInput, crossOrigin, callback, onError, debug, input]);

  return texture;
}
