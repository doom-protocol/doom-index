import { DEFAULT_ARWEAVE_GATEWAY_BASE_URL } from "../../constants/arweave";

const DEFAULT_ARWEAVE_FALLBACK_GATEWAY_BASE_URLS = ["https://arweave.net"] as const;

interface BuildArweaveGatewayBaseUrlsParams {
  fallbackGatewayBaseUrls?: readonly string[];
  preferredGatewayBaseUrl?: string;
}

export function normalizeArweaveGatewayBaseUrl(gatewayBaseUrl: string): string {
  const normalized = gatewayBaseUrl.trim().replace(/\/+$/u, "");

  if (!normalized) {
    throw new Error("Gateway base URL must not be empty");
  }

  return new URL(normalized).toString().replace(/\/+$/u, "");
}

export function buildArweaveGatewayBaseUrls(params: BuildArweaveGatewayBaseUrlsParams = {}): string[] {
  const seen = new Set<string>();
  const gateways: string[] = [];

  const pushGateway = (value: string | undefined): void => {
    if (!value) {
      return;
    }

    const normalized = normalizeArweaveGatewayBaseUrl(value);
    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    gateways.push(normalized);
  };

  pushGateway(params.preferredGatewayBaseUrl);
  pushGateway(DEFAULT_ARWEAVE_GATEWAY_BASE_URL);

  for (const fallbackGatewayBaseUrl of params.fallbackGatewayBaseUrls ?? DEFAULT_ARWEAVE_FALLBACK_GATEWAY_BASE_URLS) {
    pushGateway(fallbackGatewayBaseUrl);
  }

  return gateways;
}
