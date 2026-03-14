import nextPlugin from "@next/eslint-plugin-next";
import { posaune0423 } from "@posaune0423/eslint-config";
import { defineConfig } from "eslint/config";

const config = defineConfig([
  ...posaune0423({ typescript: true, react: true }),
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  {
    files: [
      "src/server/services/paintings/framed-glb-composition-service.ts",
      "tests/unit/server/services/paintings/framed-glb-composition-service.test.ts",
    ],
    rules: {
      "unicorn/number-literal-case": "off",
    },
  },
  {
    files: ["**/app/**/page.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          message:
            "Use numeric literals instead of expressions in const declarations (e.g., use 3600 instead of 60 * 60)",
          selector:
            "VariableDeclaration[kind='const'] > VariableDeclarator > BinaryExpression:matches([operator='*'], [operator='/'], [operator='+'], [operator='-']):has(> Literal.left):has(> Literal.right)",
        },
      ],
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "drizzle.config.ts",
      "next-env.d.ts",
      "eslint.config.ts",
      ".agents/**",
      ".codex/**",
      ".moltworker/**",
      ".wrangler/**",
      ".claude/**",
      "wt-*/**",
    ],
  },
]);

export default config;
