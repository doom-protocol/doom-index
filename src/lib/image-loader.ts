import { getBaseUrl } from "@/utils/url";
import type { ImageLoaderProps } from "next/image";

const normalizeSrc = (src: string) => (src.startsWith("/") ? src.slice(1) : src);

export default function cloudflareLoader({ src, width, quality }: ImageLoaderProps) {
  const base = getBaseUrl();
  const isLocal = base.includes("localhost") || base.includes("127.0.0.1");
  if (isLocal) return src;

  const isPreviewUrl = base.includes(".workers.dev");
  if (isPreviewUrl || src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }

  const params: string[] = [`width=${width}`, `fit=scale-down`, `format=auto`];
  if (quality) {
    params.push(`quality=${quality}`);
  }

  const absolute = `${base}/${normalizeSrc(src)}`;
  return `/cdn-cgi/image/${params.join(",")}/${absolute}`;
}
