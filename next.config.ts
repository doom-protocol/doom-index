import createMDX from "@next/mdx";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import withRspack from "next-rspack";
import { resolve as resolvePath } from "node:path";

type NextPlugin = (config: NextConfig) => NextConfig;
type WebpackAliasMap = Record<string, string | false>;

interface CacheGroup {
  name: string;
  priority: number;
  test: RegExp;
}

interface MutableWebpackConfig {
  optimization?: {
    splitChunks?: {
      cacheGroups?: Record<string, CacheGroup>;
      chunks?: "all";
    };
  };
  resolve?: {
    alias?: WebpackAliasMap;
    extensions?: string[];
    modules?: string[];
    plugins?: unknown[];
  };
}

interface WebpackOptions {
  isServer: boolean;
}

function composePlugins(...plugins: NextPlugin[]) {
  return (config: NextConfig): NextConfig => plugins.reduceRight((acc, plugin) => plugin(acc), config);
}

function getAliasMap(config: MutableWebpackConfig): WebpackAliasMap {
  return config.resolve?.alias ?? {};
}

function mergeResolve(
  config: MutableWebpackConfig,
  aliasUpdates: WebpackAliasMap,
): NonNullable<MutableWebpackConfig["resolve"]> {
  return {
    ...config.resolve,
    alias: {
      ...getAliasMap(config),
      ...aliasUpdates,
    },
  };
}

const appAliases = {
  "@": resolvePath(process.cwd(), "src"),
} as const;

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

// OpenNext wraps `next build` inside `bun run build:cf`.
// Only that worker bundle needs client-library stubs; normal SSR builds must keep the real modules.
function shouldStubServerBundle(): boolean {
  return process.env.npm_lifecycle_event === "build:cf";
}

function customizeWebpack(config: MutableWebpackConfig, { isServer }: WebpackOptions): MutableWebpackConfig {
  config.resolve = mergeResolve(config, appAliases);

  if (isServer && shouldStubServerBundle()) {
    // Only the OpenNext worker build needs these stubs.
    // Normal Next.js server renders must keep the real modules available for SSR.
    const stub = resolvePath(process.cwd(), "scripts/webpack/stub.cjs");
    const stubAliases = Object.fromEntries(serverBundleStubbedModules.map((name) => [name, stub])) as WebpackAliasMap;

    config.resolve = mergeResolve(config, stubAliases);
  }

  if (!isServer) {
    config.resolve = mergeResolve(config, {
      "@solana/wallet-adapter-react-ui/styles.css": resolvePath(
        process.cwd(),
        "node_modules/@solana/wallet-adapter-react-ui/styles.css",
      ),
    });

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
  webpack: customizeWebpack as NextConfig["webpack"],
};

const withPlugins = composePlugins(withRspack, createMDX());

export default withPlugins(nextConfig);

// `initOpenNextCloudflareForDev()` is only for local `next dev`.
// Tying it to a localhost public URL makes CI/production builds try to open Wrangler dev bindings.
if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev({ remoteBindings: true });
}
