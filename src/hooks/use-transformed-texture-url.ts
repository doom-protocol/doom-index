/**
 * Hook for getting transformed texture URLs for 3D gallery
 *
 * Applies Cloudflare Image Transformations to texture URLs with
 * device pixel ratio consideration for optimal quality/performance balance.
 */

import { getDevicePixelRatio, getImageUrlWithDpr, type ImagePreset } from "@/lib/cloudflare-image";
import { useMemo } from "react";

/**
 * Hook to get a transformed texture URL for 3D rendering
 *
 * @param imageUrl - Original image URL
 * @param preset - Image preset (default: galleryTexture)
 * @returns Transformed URL with appropriate size for the device
 */
export function useTransformedTextureUrl(imageUrl: string, preset: ImagePreset = "galleryTexture"): string {
  return useMemo(() => {
    const dpr = getDevicePixelRatio();
    return getImageUrlWithDpr(imageUrl, preset, dpr);
  }, [imageUrl, preset]);
}
