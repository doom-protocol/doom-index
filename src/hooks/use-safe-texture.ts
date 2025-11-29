"use client";

import { useEffect, useMemo, useState } from "react";
import { TextureLoader, type Texture } from "three";
import { logger } from "@/utils/logger";

// ============================================================================
// Types
// ============================================================================

type CrossOrigin = "" | "anonymous" | "use-credentials";

type UseSafeTextureOptions = {
  /** TextureLoader.setCrossOrigin value. Default "" (no CORS) */
  crossOrigin?: CrossOrigin;
  /** Transform URL if needed */
  transformUrl?: (url: string) => string;
  /** Called when texture is loaded */
  onLoad?: (texture: Texture | Texture[]) => void;
  /** Called when error occurs */
  onError?: (error: Error, url: string) => void;
  /** Enable debug logging */
  debug?: boolean;
};

type LoadEntry = { key: string; url: string };

// ============================================================================
// Helpers
// ============================================================================

/** Normalize input to unified LoadEntry array */
function normalizeInput(
  input: string | string[] | Record<string, string>,
  transformUrl?: (url: string) => string,
): { entries: LoadEntry[]; inputType: "single" | "array" | "object" } {
  const transform = (url: string) => transformUrl?.(url) ?? url;

  if (typeof input === "string") {
    return {
      entries: [{ key: "0", url: transform(input) }],
      inputType: "single",
    };
  }

  if (Array.isArray(input)) {
    return {
      entries: input.map((url, i) => ({ key: String(i), url: transform(url) })),
      inputType: "array",
    };
  }

  return {
    entries: Object.entries(input).map(([key, url]) => ({ key, url: transform(url) })),
    inputType: "object",
  };
}

/** Convert loaded textures map to appropriate output format */
function formatOutput(
  textureMap: Map<string, Texture>,
  inputType: "single" | "array" | "object",
  entries: LoadEntry[],
): Texture | Texture[] | Record<string, Texture> {
  if (inputType === "single") {
    return textureMap.get("0")!;
  }

  if (inputType === "array") {
    return entries.map(e => textureMap.get(e.key)!);
  }

  const result: Record<string, Texture> = {};
  for (const e of entries) {
    result[e.key] = textureMap.get(e.key)!;
  }
  return result;
}

/** Safe error conversion */
function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Safe texture loader using THREE.TextureLoader directly.
 * Supports single URL, array of URLs, or object of URLs.
 */
export function useSafeTexture(
  input: string | string[] | Record<string, string>,
  optionsOrCallback?: UseSafeTextureOptions | ((texture: Texture | Texture[]) => void),
): Texture | Texture[] | Record<string, Texture> | null {
  // Parse options
  const isCallback = typeof optionsOrCallback === "function";
  const options = isCallback ? {} : (optionsOrCallback ?? {});
  const onLoadCallback = isCallback ? optionsOrCallback : options.onLoad;

  const { crossOrigin = "", transformUrl, onError, debug = process.env.NODE_ENV === "development" } = options;

  // Normalize input to unified structure
  const { entries, inputType } = useMemo(() => normalizeInput(input, transformUrl), [input, transformUrl]);

  const [result, setResult] = useState<Texture | Texture[] | Record<string, Texture> | null>(null);
  const [_loading, setLoading] = useState(true);
  const [_error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (entries.length === 0) {
      setResult(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const loader = new TextureLoader();
    if (crossOrigin) {
      loader.setCrossOrigin(crossOrigin);
    }

    const textureMap = new Map<string, Texture>();
    let loadedCount = 0;
    let hasError = false;

    const handleSuccess = (entry: LoadEntry, texture: Texture) => {
      if (hasError) return;

      textureMap.set(entry.key, texture);
      loadedCount++;

      // All textures loaded
      if (loadedCount < entries.length) return;

      const output = formatOutput(textureMap, inputType, entries);
      setResult(output);
      setLoading(false);
      setError(null);

      // Execute callback
      try {
        onLoadCallback?.(inputType === "single" ? (output as Texture) : (output as Texture[]));
        if (debug) {
          logger.debug("[useSafeTexture] Loaded:", { count: entries.length, type: inputType });
        }
      } catch (callbackError) {
        const err = toError(callbackError);
        if (debug) {
          logger.debug("[useSafeTexture] Callback error:", { error: err.message });
        }
        onError?.(err, entry.url);
      }
    };

    const handleError = (entry: LoadEntry, err: unknown) => {
      if (hasError) return;
      hasError = true;

      const error = toError(err);
      setError(error);
      setLoading(false);

      if (debug) {
        logger.debug("[useSafeTexture] Load error:", { url: entry.url, error: error.message });
      }
      onError?.(error, entry.url);
    };

    // Load all textures
    for (const entry of entries) {
      loader.load(
        entry.url,
        texture => handleSuccess(entry, texture),
        undefined,
        err => handleError(entry, err),
      );
    }
  }, [entries, inputType, crossOrigin, onLoadCallback, onError, debug]);

  return result;
}
