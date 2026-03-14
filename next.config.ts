import type { NextConfig } from "next";
import { buildArweaveGatewayBaseUrls } from "./src/lib/pure/arweave-gateway";

const arweaveGatewayUrls = buildArweaveGatewayBaseUrls({
  preferredGatewayBaseUrl: process.env.ARWEAVE_GATEWAY_BASE_URL,
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],
  experimental: {
    viewTransition: true,
    scrollRestoration: true,
    cssChunking: true,
    mdxRs: {
      mdxType: "gfm",
    },
  },
  pageExtensions: ["ts", "tsx", "mdx"],
  images: {
    remotePatterns: arweaveGatewayUrls.map((gatewayUrl) => {
      const parsedGatewayUrl = new URL(gatewayUrl);

      return {
        protocol: parsedGatewayUrl.protocol === "https:" ? "https" : "http",
        hostname: parsedGatewayUrl.hostname,
        pathname: "/**",
      };
    }),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
