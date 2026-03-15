import { cloudflare } from "@cloudflare/vite-plugin";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import vinext from "vinext";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    mdx(),
    tailwindcss(),
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  resolve: {
    alias: {
      buffer: fileURLToPath(new URL("./node_modules/buffer/index.js", import.meta.url)),
      "node:buffer": fileURLToPath(new URL("./node_modules/buffer/index.js", import.meta.url)),
    },
  },
});
