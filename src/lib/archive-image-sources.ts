import { IMAGE_PRESETS, transformImageUrlWithBaseUrl } from "@/lib/cloudflare-image";
import { buildArweaveGatewayBaseUrls } from "@/lib/pure/arweave-gateway";
import { getBaseUrl } from "@/utils/url";

interface ArchiveImageSourceOptions {
  baseUrl?: string;
  fallbackGatewayBaseUrls?: readonly string[];
}

function buildGatewayUrlForPath(imageUrl: URL, gatewayBaseUrl: string): string {
  const nextUrl = new URL(imageUrl.pathname + imageUrl.search + imageUrl.hash, `${gatewayBaseUrl}/`);
  return nextUrl.toString();
}

function buildArchiveImageCandidateUrls(imageUrl: string, fallbackGatewayBaseUrls?: readonly string[]): string[] {
  if (imageUrl.includes("/cdn-cgi/image/")) {
    return [imageUrl];
  }

  if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
    return [imageUrl];
  }

  try {
    const parsedUrl = new URL(imageUrl);

    return buildArweaveGatewayBaseUrls({
      fallbackGatewayBaseUrls,
      preferredGatewayBaseUrl: parsedUrl.origin,
    }).map((gatewayBaseUrl) => buildGatewayUrlForPath(parsedUrl, gatewayBaseUrl));
  } catch {
    return [imageUrl];
  }
}

export function getArchiveImageSources(imageUrl: string, options: ArchiveImageSourceOptions = {}): string[] {
  const baseUrl = options.baseUrl ?? getBaseUrl();

  return buildArchiveImageCandidateUrls(imageUrl, options.fallbackGatewayBaseUrls).map((candidateUrl) =>
    transformImageUrlWithBaseUrl(candidateUrl, IMAGE_PRESETS.archiveGrid, baseUrl),
  );
}
