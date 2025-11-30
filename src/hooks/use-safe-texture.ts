/**
 * Safe texture loading hook with crossOrigin and error handling support.
 *
 * This is a modified version of @react-three/drei's useTexture hook with additional options:
 * - crossOrigin: Sets the crossOrigin property on TextureLoader for CORS handling
 * - onError: Provides error handling callback for texture loading failures
 *
 * Based on: https://github.com/pmndrs/drei/blob/7d901b5c/src/core/Texture.tsx
 */

import { Texture as _Texture, TextureLoader } from "three";

import { useLoader, useThree } from "@react-three/fiber";

import { useLayoutEffect, useEffect, useMemo } from "react";

export const IsObject = (url: unknown): url is Record<string, string> =>
  url === Object(url) && !Array.isArray(url) && typeof url !== "function";

type TextureArray<T> = T extends string[] ? _Texture[] : never;

type TextureRecord<T> = T extends Record<string, string> ? { [key in keyof T]: _Texture } : never;

type SingleTexture<T> = T extends string ? _Texture : never;

export type MappedTextureType<T extends string[] | string | Record<string, string>> =
  | TextureArray<T>
  | TextureRecord<T>
  | SingleTexture<T>;

/**
 * Options for useSafeTexture hook
 */
export interface UseSafeTextureOptions {
  /**
   * Sets the crossOrigin property on TextureLoader for CORS handling.
   * Common values: 'anonymous', 'use-credentials', or "" for no CORS (default).
   * Defaults to "" (no CORS) to avoid cached loader crossOrigin issues.
   */
  crossOrigin?: string;

  /**
   * Error callback function called when texture loading fails.
   * Receives the error object as parameter.
   */
  onError?: (error: unknown) => void;
}

/**
 * Hook for loading textures with enhanced safety features.
 *
 * Extends @react-three/drei's useTexture with crossOrigin and error handling options.
 * Supports single URLs, arrays of URLs, and objects mapping names to URLs.
 *
 * @param input - URL string, array of URLs, or object mapping names to URLs
 * @param onLoad - Optional callback called when textures are loaded
 * @param options - Additional options for crossOrigin and error handling
 * @returns Mapped texture(s) matching the input type
 */
export function useSafeTexture<Url extends string[] | string | Record<string, string>>(
  input: Url,
  onLoad?: (texture: MappedTextureType<Url>) => void,
  options: UseSafeTextureOptions = {},
): MappedTextureType<Url> {
  const { crossOrigin = "", onError } = options;
  const gl = useThree(state => state.gl);

  // Enhanced useLoader call with custom extensions for crossOrigin and error handling
  // This differs from drei's implementation by adding crossOrigin and onError support
  // Always sets crossOrigin to avoid cached loader issues
  const textures = useLoader(TextureLoader, IsObject(input) ? Object.values(input) : input, (loader: TextureLoader) => {
    // Always set crossOrigin to override any cached loader settings
    loader.crossOrigin = crossOrigin;

    // Set custom error handler - not available in standard drei useTexture
    if (onError) {
      loader.manager.onError = onError;
    }
  }) as MappedTextureType<Url>;

  useLayoutEffect(() => {
    onLoad?.(textures);
  }, [onLoad, textures]);

  // https://github.com/mrdoob/three.js/issues/22696
  // Upload the texture to the GPU immediately instead of waiting for the first render
  // NOTE: only available for WebGLRenderer
  useEffect(() => {
    if ("initTexture" in gl) {
      let textureArray: _Texture[] = [];
      if (Array.isArray(textures)) {
        textureArray = textures;
      } else if (textures instanceof _Texture) {
        textureArray = [textures];
      } else if (IsObject(textures)) {
        textureArray = Object.values(textures);
      }

      textureArray.forEach(texture => {
        if (texture instanceof _Texture) {
          gl.initTexture(texture);
        }
      });
    }
  }, [gl, textures]);

  const mappedTextures = useMemo(() => {
    if (IsObject(input)) {
      const keyed: Record<string, _Texture> = {};
      let i = 0;
      for (const key in input) keyed[key] = (textures as _Texture[])[i++];
      return keyed as MappedTextureType<Url>;
    } else {
      return textures;
    }
  }, [input, textures]);

  return mappedTextures;
}

useSafeTexture.preload = (url: string | string[], options: UseSafeTextureOptions = {}) => {
  const { crossOrigin = "", onError } = options;
  return useLoader.preload(TextureLoader, url, (loader: TextureLoader) => {
    // Always set crossOrigin to override any cached loader settings
    loader.crossOrigin = crossOrigin;
    if (onError) {
      loader.manager.onError = onError;
    }
  });
};

useSafeTexture.clear = (input: string | string[]) => useLoader.clear(TextureLoader, input);
