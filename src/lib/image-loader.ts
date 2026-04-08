import type { ImageLoaderProps } from "next/image";

function normalizeSrc(src: string): string {
  return src.startsWith("/") ? src.slice(1) : src;
}

export default function cloudflareImageLoader({ src, width, quality }: ImageLoaderProps): string {
  if (process.env.NODE_ENV === "development") {
    return src;
  }

  if (src.includes("/cdn-cgi/image/")) {
    return src;
  }

  const params = [`width=${String(width)}`];
  if (quality) {
    params.push(`quality=${String(quality)}`);
  }

  return `/cdn-cgi/image/${params.join(",")}/${normalizeSrc(src)}`;
}
