import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

// Base ESLint rules
const baseRules = {
  // Disable equals-negative-zero warning (caused by Three.js library)
  "equals-negative-zero": "off",
  "object-shorthand": "error",
};

// React rules
const reactRules = {
  "react/jsx-curly-brace-presence": "error",
  // New JSX Transform: React import is not required for JSX
  "react/jsx-uses-react": "off",
  "react/react-in-jsx-scope": "off",
  // React hooks
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/exhaustive-deps": "warn",
};

// TypeScript rules for production code
const typescriptRules = {
  // import は必ず type import / value import を区別
  "@typescript-eslint/consistent-type-imports": [
    "error",
    {
      prefer: "type-imports",
      fixStyle: "inline-type-imports",
    },
  ],
  // Promise を投げっぱなしにしない
  "@typescript-eslint/no-floating-promises": ["error", { ignoreIIFE: true }],
  // イベントハンドラなどでの Promise misuse を検出
  "@typescript-eslint/no-misused-promises": [
    "error",
    {
      checksVoidReturn: {
        attributes: false, // onClick={() => void asyncFn()} などは実運用で許す
        properties: true,
        inheritedMethods: true,
      },
    },
  ],
  // 非同期関数で await を使用していない場合を検出
  "@typescript-eslint/require-await": "error",
  // React components don't need explicit return types (JSX.Element is inferred)
  "@typescript-eslint/explicit-function-return-type": "off",
  // Allow unused variables with underscore prefix
  "@typescript-eslint/no-unused-vars": [
    "warn",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    },
  ],
};

// TypeScript rules for test files (more lenient)
const testTypescriptRules = {
  // import は必ず type import / value import を区別
  "@typescript-eslint/consistent-type-imports": [
    "error",
    {
      prefer: "type-imports",
      fixStyle: "inline-type-imports",
    },
  ],
  // Test and script files often have mock async functions without await
  "@typescript-eslint/no-floating-promises": "off",
  "@typescript-eslint/require-await": "off",
  // Next.js img element rule not applicable in tests
  "@next/next/no-img-element": "off",
  // Allow unused variables with underscore prefix
  "@typescript-eslint/no-unused-vars": [
    "warn",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    },
  ],
};

// Ignore patterns
const ignoreConfig = {
  ignores: [
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    ".cursor/**",
    ".kiro/**",
    "public/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ],
};

// Base configuration with React rules
const baseConfig = {
  plugins: {
    react: pluginReact,
    "react-hooks": pluginReactHooks,
  },
  rules: {
    ...baseRules,
    ...reactRules,
  },
};

// Special configuration for use-mobile hook
const mobileHookConfig = {
  files: ["src/hooks/use-mobile.ts"],
  rules: {
    "react-hooks/exhaustive-deps": "off",
  },
};

// TypeScript configuration for production code
const typescriptConfig = {
  files: ["src/**/*.ts", "src/**/*.tsx"],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: "./tsconfig.json",
    },
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin,
  },
  rules: typescriptRules,
};

// TypeScript configuration for test files
const testTypescriptConfig = {
  files: ["tests/**/*.ts", "tests/**/*.tsx", "scripts/**/*.ts"],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: "./tsconfig.json",
    },
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin,
  },
  rules: testTypescriptRules,
};

const eslintConfig = defineConfig([ignoreConfig, baseConfig, mobileHookConfig, typescriptConfig, testTypescriptConfig]);

export default eslintConfig;
