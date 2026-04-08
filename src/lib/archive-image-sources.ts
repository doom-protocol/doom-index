import { buildArweaveGatewayBaseUrls, parseArweaveGatewayBaseUrls } from "@/lib/pure/arweave-gateway";

interface ArchiveImageSourceOptions {
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
  const configuredFallbackGatewayBaseUrls = parseArweaveGatewayBaseUrls(
    process.env.NEXT_PUBLIC_ARWEAVE_FALLBACK_GATEWAY_BASE_URLS,
  );
  const fallbackGatewayBaseUrls =
    options.fallbackGatewayBaseUrls ??
    (configuredFallbackGatewayBaseUrls.length > 0 ? configuredFallbackGatewayBaseUrls : undefined);

  return buildArchiveImageCandidateUrls(imageUrl, fallbackGatewayBaseUrls);
}
