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
    if (isServer) {
      const stub = path.resolve(process.cwd(), "src/mocks/stub.js");
      config.resolve.alias = {
        ...config.resolve.alias,
        // Three.js / React Three Fiber
        three: stub,
        "three-stdlib": stub,
        "@react-three/fiber": stub,
        "@react-three/drei": stub,
        // Solana
        "@solana/web3.js": stub,
        "@solana/wallet-adapter-base": stub,
        "@solana/wallet-adapter-react": stub,
        "@solana/wallet-adapter-react-ui": stub,
        "@solana/wallet-adapter-wallets": stub,
        // Browser-only utilities
        "use-sound": stub,
        "use-haptic": stub,
        sonner: stub,
        "js-tiktoken": stub,
        leva: stub,
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
