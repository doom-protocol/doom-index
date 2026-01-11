import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import withRspack from "next-rspack";
import path from "path";

/**
 * Compose multiple Next.js plugins
 */
type NextPlugin = (config: NextConfig) => NextConfig;

function composePlugins(...plugins: NextPlugin[]) {
  return (config: NextConfig): NextConfig => plugins.reduceRight((acc, plugin) => plugin(acc), config);
}

const serverBundleStubbedModules = [
  // Three.js / React Three Fiber
  "three",
  "three-stdlib",
  "@react-three/fiber",
  "@react-three/drei",
  // Solana
  "@solana/web3.js",
  "@solana/wallet-adapter-base",
  "@solana/wallet-adapter-react",
  "@solana/wallet-adapter-react-ui",
  "@solana/wallet-adapter-wallets",
  // Browser-only utilities
  "use-sound",
  "use-haptic",
  "sonner",
  "js-tiktoken",
  "leva",
] as const;

function shouldStubServerBundle(): boolean {
  const v = process.env.DOOM_ENABLE_SERVER_BUNDLE_STUBS;
  return v === "1" || v === "true";
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
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
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  typedRoutes: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Server-side: stub browser-only libraries to reduce bundle size
    if (isServer && shouldStubServerBundle()) {
      const stub = path.resolve(process.cwd(), "scripts/webpack/stub.cjs");
      const stubAliases = Object.fromEntries(serverBundleStubbedModules.map((name) => [name, stub]));
      config.resolve.alias = {
        ...config.resolve.alias,
        ...stubAliases,
      };
    }

    // Client-side: optimize vendor chunks
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@solana/wallet-adapter-react-ui/styles.css": path.resolve(
          process.cwd(),
          "node_modules/@solana/wallet-adapter-react-ui/styles.css",
        ),
      };

      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
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
  },
};

// Compose plugins: Rspack (fast bundler) + MDX support
const withPlugins = composePlugins(withRspack, createMDX());

export default withPlugins(nextConfig);

// Initialize OpenNext Cloudflare bindings for local development
// Use NEXT_PUBLIC_BASE_URL to detect development environment instead of NODE_ENV
// because NODE_ENV can be unreliable in Cloudflare Workers due to build optimizations
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
if (baseUrl.includes("localhost")) {
  void initOpenNextCloudflareForDev({ remoteBindings: true });
}
