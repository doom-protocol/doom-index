import createMDX from "@next/mdx";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { resolve as resolvePath } from "node:path";
import { buildArweaveGatewayBaseUrls } from "./src/lib/pure/arweave-gateway";

interface MutableWebpackConfig {
  optimization?: {
    splitChunks?: {
      cacheGroups?: Record<string, { name: string; priority: number; test: RegExp }>;
      chunks?: "all";
    };
  };
  resolve?: {
    alias?: Record<string, string | false>;
  };
}

const serverBundleStubbedModules = [
  "three",
  "three-stdlib",
  "@react-three/fiber",
  "@react-three/drei",
  "leva",
  "sonner",
  "use-sound",
  "use-haptic",
  "@solana/web3.js",
  "@solana/wallet-adapter-base",
  "@solana/wallet-adapter-react",
  "@solana/wallet-adapter-react-ui",
  "@solana/wallet-adapter-wallets",
  "@metaplex-foundation/mpl-token-metadata",
  "@metaplex-foundation/umi",
  "@metaplex-foundation/umi-bundle-defaults",
  "@metaplex-foundation/umi-signer-wallet-adapters",
] as const;

const isNextDev = process.env.npm_lifecycle_event === "dev" || process.argv[2] === "dev";
const isCloudflareBuild = process.env.npm_lifecycle_event === "build:cf";
const arweaveGatewayUrls = buildArweaveGatewayBaseUrls({
  preferredGatewayBaseUrl: process.env.ARWEAVE_GATEWAY_BASE_URL,
});

function customizeWebpack(config: MutableWebpackConfig, { isServer }: { isServer: boolean }): MutableWebpackConfig {
  config.resolve ??= {};
  config.resolve.alias ??= {};

  if (isServer && isCloudflareBuild) {
    // Only the OpenNext worker build needs these stubs.
    // Normal Next.js server renders must keep the real modules available for SSR.
    const stub = resolvePath(process.cwd(), "scripts/webpack/stub.cjs");
    Object.assign(config.resolve.alias, Object.fromEntries(serverBundleStubbedModules.map((name) => [name, stub])));
  }

  if (!isServer) {
    config.resolve.alias["@solana/wallet-adapter-react-ui/styles.css"] = resolvePath(
      process.cwd(),
      "node_modules/@solana/wallet-adapter-react-ui/styles.css",
    );

    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization?.splitChunks,
        chunks: "all",
        cacheGroups: {
          ...config.optimization?.splitChunks?.cacheGroups,
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|@react-three\/fiber|@react-three\/drei|three|three-stdlib)[\\/]/,
            name: "react-vendor",
            priority: 10,
          },
          solana: {
            test: /[\\/]node_modules[\\/](@solana\/|@metaplex-foundation\/)[\\/]/,
            name: "solana-vendor",
            priority: 10,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendor",
            priority: 5,
          },
        },
      },
    };
  }

  return config;
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
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
  typedRoutes: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: customizeWebpack as NextConfig["webpack"],
};

const withMDX = createMDX();
const configWithMDX = withMDX(nextConfig);

export default configWithMDX;

// `initOpenNextCloudflareForDev()` is only for local `next dev`.
// Tying it to a localhost public URL makes CI/production builds try to open Wrangler dev bindings.
if (isNextDev) {
  void initOpenNextCloudflareForDev({ remoteBindings: true });
}
