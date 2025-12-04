import { buildLoaderImageUrl } from "@/lib/cloudflare-image";
import type { ImageLoaderProps } from "next/image";

export default function cloudflareLoader({ src, width, quality }: ImageLoaderProps): string {
  return buildLoaderImageUrl(src, width, quality);
}
