import createMDX from "@next/mdx";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { resolve as resolvePath } from "node:path";
import { DEFAULT_ARWEAVE_GATEWAY_BASE_URL } from "./src/constants/arweave";

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
const arweaveGatewayUrl = new URL(DEFAULT_ARWEAVE_GATEWAY_BASE_URL);

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],
  serverExternalPackages: [...serverBundleStubbedModules],
  experimental: {
    viewTransition: true,
    scrollRestoration: true,
    cssChunking: true,
    mdxRs: {
      mdxType: "gfm",
    },
  },
  turbopack: {
    resolveAlias: {
      "@solana/wallet-adapter-react-ui/styles.css": resolvePath(
        process.cwd(),
        "node_modules/@solana/wallet-adapter-react-ui/styles.css",
      ),
    },
  },
  pageExtensions: ["ts", "tsx", "mdx"],
  images: {
    remotePatterns: [
      {
        protocol: arweaveGatewayUrl.protocol === "https:" ? "https" : "http",
        hostname: arweaveGatewayUrl.hostname,
        pathname: "/**",
      },
    ],
  },
  typedRoutes: true,
  typescript: {
    ignoreBuildErrors: true,
  },
};

const withMDX = createMDX();
const configWithMDX = withMDX(nextConfig);

export default configWithMDX;

// `initOpenNextCloudflareForDev()` is only for local `next dev`.
// Tying it to a localhost public URL makes CI/production builds try to open Wrangler dev bindings.
if (isNextDev) {
  void initOpenNextCloudflareForDev({ remoteBindings: true });
}
