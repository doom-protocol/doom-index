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

const serverBundleStubbedModules = [
  "three",
  "three-stdlib",
  "@react-three/fiber",
  "@react-three/drei",
  "@solana/web3.js",
  "@solana/wallet-adapter-base",
  "@solana/wallet-adapter-react",
  "@solana/wallet-adapter-react-ui",
  "@solana/wallet-adapter-wallets",
  "use-sound",
  "use-haptic",
  "sonner",
  "js-tiktoken",
  "leva",
] as const;

function shouldStubServerBundle(): boolean {
  const value = process.env.DOOM_ENABLE_SERVER_BUNDLE_STUBS;
  return value === "1" || value === "true";
}

function customizeWebpack(config: MutableWebpackConfig, { isServer }: WebpackOptions): MutableWebpackConfig {
  if (isServer && shouldStubServerBundle()) {
    const stub = resolvePath(process.cwd(), "scripts/webpack/stub.cjs");
    const stubAliases = Object.fromEntries(serverBundleStubbedModules.map((name) => [name, stub])) as WebpackAliasMap;

    config.resolve = {
      alias: {
        ...getAliasMap(config),
        ...stubAliases,
      },
    };
  }

  if (!isServer) {
    config.resolve = {
      alias: {
        ...getAliasMap(config),
        "@solana/wallet-adapter-react-ui/styles.css": resolvePath(
          process.cwd(),
          "node_modules/@solana/wallet-adapter-react-ui/styles.css",
        ),
      },
    };

    config.optimization = {
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

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
if (typeof baseUrl === "string" && baseUrl.includes("localhost")) {
  void initOpenNextCloudflareForDev({ remoteBindings: true });
}
