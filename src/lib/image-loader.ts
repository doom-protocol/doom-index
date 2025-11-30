import { getBaseUrl } from "@/utils/url";
import type { ImageLoaderProps } from "next/image";

const normalizeSrc = (src: string) => (src.startsWith("/") ? src.slice(1) : src);

/**
 * Cloudflare Image Loader for Next.js Image component
 *
 * Automatically applies Cloudflare Image Transformations with:
 * - Responsive width based on Next.js srcset
 * - Auto format (WebP/AVIF based on browser support)
 * - Scale-down fit to prevent enlargement
 * - Configurable quality
 *
 * @see https://developers.cloudflare.com/images/transform-images/transform-via-url/
 */
export default function cloudflareLoader({ src, width, quality }: ImageLoaderProps) {
  const base = getBaseUrl();
  const isLocal = base.includes("localhost") || base.includes("127.0.0.1");
  if (isLocal) return src;

  // Check if this is a preview URL (workers.dev domain)
  // Cloudflare Image Transformations (/cdn-cgi/image/) don't work on preview URLs
  const isPreviewUrl = base.includes(".workers.dev");

  // If it's a preview URL or the src is already an absolute URL, return it directly
  // This avoids using /cdn-cgi/image/ which doesn't work on preview URLs
  if (isPreviewUrl || src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }

  // Build transformation parameters
  const params: string[] = [
    `width=${width}`,
    `fit=scale-down`, // Never enlarge images
    `format=auto`, // Serve WebP/AVIF based on browser support
  ];

  // Add quality if specified (default is 85 in Cloudflare)
  if (quality) {
    params.push(`quality=${quality}`);
  }

  const absolute = `${base}/${normalizeSrc(src)}`;

  return `/cdn-cgi/image/${params.join(",")}/${absolute}`;
}
