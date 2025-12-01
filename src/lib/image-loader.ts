import { getBaseUrl } from "@/utils/url";
import type { ImageLoaderProps } from "next/image";

const normalizeSrc = (src: string) => (src.startsWith("/") ? src.slice(1) : src);

export default function cloudflareLoader({ src, width, quality }: ImageLoaderProps) {
  const base = getBaseUrl();
  const isLocal = base.includes("localhost") || base.includes("127.0.0.1");
  if (isLocal) return src;

  // Check if this is a preview URL (workers.dev domain)
  // Cloudflare Image Transformations (/cdn-cgi/image/) don't work on preview URLs
  const isPreviewUrl = base.includes(".workers.dev");

  // If it's a preview URL or the src is already an absolute URL, return it directly
  // This avoids using /cdn-cgi/image/ which doesn't work on preview URLs
  // Also bypass if src starts with /api/r2/ as this endpoint serves images directly
  if (isPreviewUrl || src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/api/r2/")) {
    return src;
  }

  const params = [`width=${width}`];
  if (quality) params.push(`quality=${quality}`);

  const absolute = `${base}/${normalizeSrc(src)}`;

  return `/cdn-cgi/image/${params.join(",")}/${absolute}`;
}
