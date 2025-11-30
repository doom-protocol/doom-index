import { getBaseUrl } from "@/utils/url";

export interface CloudflareImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
  format?: "auto" | "webp" | "avif" | "jpeg" | "png";
  dpr?: number;
  sharpen?: number;
}

export const IMAGE_PRESETS = {
  archiveGrid: {
    width: 320,
    fit: "cover" as const,
    quality: 70,
    format: "auto" as const,
  },
  galleryTexture: {
    width: 512,
    fit: "scale-down" as const,
    quality: 75,
    format: "auto" as const,
  },
  galleryTextureHigh: {
    width: 1024,
    fit: "scale-down" as const,
    quality: 80,
    format: "auto" as const,
  },
  modalFull: {
    width: 1200,
    fit: "scale-down" as const,
    quality: 80,
    format: "auto" as const,
  },
  mobile: {
    width: 480,
    fit: "scale-down" as const,
    quality: 70,
    format: "auto" as const,
  },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

function isCloudflareTransformSupported(): boolean {
  const base = getBaseUrl();
  if (base.includes("localhost") || base.includes("127.0.0.1")) {
    return false;
  }
  if (base.includes(".workers.dev")) {
    return false;
  }
  return true;
}

function buildTransformParams(options: CloudflareImageOptions): string {
  const params: string[] = [];

  if (options.width) params.push(`width=${options.width}`);
  if (options.height) params.push(`height=${options.height}`);
  if (options.quality) params.push(`quality=${options.quality}`);
  if (options.fit) params.push(`fit=${options.fit}`);
  if (options.format) params.push(`format=${options.format}`);
  if (options.dpr && options.dpr !== 1) params.push(`dpr=${options.dpr}`);
  if (options.sharpen) params.push(`sharpen=${options.sharpen}`);

  return params.join(",");
}

export function transformImageUrl(imageUrl: string, options: CloudflareImageOptions): string {
  if (!isCloudflareTransformSupported()) {
    return imageUrl;
  }
  if (Object.keys(options).length === 0) {
    return imageUrl;
  }
  if (imageUrl.includes("/cdn-cgi/image/")) {
    return imageUrl;
  }

  const params = buildTransformParams(options);
  if (!params) {
    return imageUrl;
  }

  const base = getBaseUrl();

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    try {
      const url = new URL(imageUrl);
      const baseHost = new URL(base).host;
      if (url.host === baseHost || url.host.includes("doomindex")) {
        return `${url.origin}/cdn-cgi/image/${params}${url.pathname}${url.search}`;
      }
      return `/cdn-cgi/image/${params}/${imageUrl}`;
    } catch {
      return imageUrl;
    }
  }

  const normalizedPath = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `/cdn-cgi/image/${params}${normalizedPath}`;
}

export function getImageUrlForContext(
  imageUrl: string,
  preset: ImagePreset,
  overrides?: Partial<CloudflareImageOptions>,
): string {
  const presetOptions = IMAGE_PRESETS[preset];
  const options: CloudflareImageOptions = { ...presetOptions, ...overrides };

  return transformImageUrl(imageUrl, options);
}

export function getImageUrlWithDpr(imageUrl: string, preset: ImagePreset, dpr: number = 1): string {
  const presetOptions = IMAGE_PRESETS[preset];
  const clampedDpr = Math.min(Math.max(dpr, 1), 1.5);
  const options: CloudflareImageOptions = {
    ...presetOptions,
    width: presetOptions.width ? Math.round(presetOptions.width * clampedDpr) : undefined,
  };
  return transformImageUrl(imageUrl, options);
}

export function getDevicePixelRatio(): number {
  if (typeof window === "undefined") {
    return 1;
  }
  return window.devicePixelRatio || 1;
}
