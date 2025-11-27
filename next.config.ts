import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import path from "path";
import remarkGfm from "remark-gfm";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    viewTransition: true,
    scrollRestoration: true,
    // mdxRs: true,
  },
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  webpack: (config, { isServer }) => {
    // js-tiktoken is used in Edge runtime but not needed for server logic in this case,
    // or we want to polyfill it. However, to keep it simple and consistent with other mocks,
    // we can try to use the stub if it's not critically used in a way that breaks the app.
    // Based on previous context, it seems we wanted to exclude it.

    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "js-tiktoken": path.resolve(process.cwd(), "src/mocks/stub.js"),
        three: path.resolve(process.cwd(), "src/mocks/stub.js"),
        "three-stdlib": path.resolve(process.cwd(), "src/mocks/stub.js"),
        "@react-three/fiber": path.resolve(process.cwd(), "src/mocks/stub.js"),
        "@react-three/drei": path.resolve(process.cwd(), "src/mocks/stub.js"),
        "@solana/web3.js": path.resolve(process.cwd(), "src/mocks/stub.js"),
        // Solana wallet adapter 関連
        "@solana/wallet-adapter-base": path.resolve(process.cwd(), "src/mocks/stub.js"),
        "@solana/wallet-adapter-react": path.resolve(process.cwd(), "src/mocks/stub.js"),
        "@solana/wallet-adapter-react-ui": path.resolve(process.cwd(), "src/mocks/stub.js"),
        "@solana/wallet-adapter-wallets": path.resolve(process.cwd(), "src/mocks/stub.js"),
        // ブラウザ専用ライブラリ
        "use-sound": path.resolve(process.cwd(), "src/mocks/stub.js"),
        "use-haptic": path.resolve(process.cwd(), "src/mocks/stub.js"),
        sonner: path.resolve(process.cwd(), "src/mocks/stub.js"),
        // CSSファイルはクライアントサイドでのみ使用
        // "@solana/wallet-adapter-react-ui/styles.css": path.resolve(process.cwd(), "src/mocks/stub.js"),
      };
    }

    // クライアントサイドでのバンドル最適化
    if (!isServer) {
      // CSSファイルの解決を追加
      config.resolve.alias = {
        ...config.resolve.alias,
        "@solana/wallet-adapter-react-ui/styles.css": path.resolve(
          process.cwd(),
          "node_modules/@solana/wallet-adapter-react-ui/styles.css",
        ),
      };

      // ベンダーチャンクの分割
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            // React関連ライブラリを分離
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|@react-three\/fiber|@react-three\/drei|three|three-stdlib)[\\/]/,
              name: "react-vendor",
              priority: 10,
            },
            // Solana関連ライブラリを分離
            solana: {
              test: /[\\/]node_modules[\\/](@solana\/|@metaplex-foundation\/)[\\/]/,
              name: "solana-vendor",
              priority: 10,
            },
            // その他のベンダーライブラリ
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

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [],
  },
});

export default withMDX(nextConfig);

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev({ remoteBindings: true });
}
