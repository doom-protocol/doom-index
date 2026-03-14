import { cloudflare } from "@cloudflare/vite-plugin";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import vinext from "vinext";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

const shimReactCanary = (): Plugin => ({
  name: "shim-react-canary",
  resolveId(id) {
    if (id === "virtual:react-with-canary") {
      return "\0virtual:react-with-canary";
    }
  },
  load(id) {
    if (id === "\0virtual:react-with-canary") {
      return `
        export * from "react";
        export { default } from "react";
        import React from "react";
        export const ViewTransition = React.ViewTransition || (({ children }) => children);
        export const addTransitionType = React.addTransitionType || (() => {});
      `;
    }
  },
  transform(code, id) {
    if (
      id.includes("node_modules") ||
      (!id.endsWith(".tsx") && !id.endsWith(".ts") && !id.endsWith(".jsx") && !id.endsWith(".js")) ||
      (!code.includes("ViewTransition") && !code.includes("addTransitionType")) ||
      !/from\s+['"]react['"]/.test(code)
    ) {
      return null;
    }

    const importRegex = /import\s*\{[^}]*(ViewTransition|addTransitionType)[^}]*\}\s*from\s*['"]react['"]/;
    if (!importRegex.test(code)) {
      return null;
    }

    const transformedCode = code.replace(/from\s*['"]react['"]/g, 'from "virtual:react-with-canary"');
    return transformedCode === code ? null : { code: transformedCode, map: null };
  },
});

export default defineConfig({
  plugins: [
    shimReactCanary(),
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
