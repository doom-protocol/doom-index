import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    viewTransition: true,
  },
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});

export default withMDX(nextConfig);

// Only initialize OpenNext Cloudflare dev mode in local development
// Skip in CI and production builds
if (!process.env.CI && process.env.NODE_ENV !== "production") {
  // Dynamic import to avoid execution in CI/production
  import("@opennextjs/cloudflare").then((module) => {
    module.initOpenNextCloudflareForDev();
  });
}
