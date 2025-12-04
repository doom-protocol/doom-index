import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";
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
  // distinguish type import and value import
  "@typescript-eslint/consistent-type-imports": [
    "error",
    {
      prefer: "type-imports",
      fixStyle: "inline-type-imports",
    },
  ],
  // don't throw promises
  "@typescript-eslint/no-floating-promises": ["error", { ignoreIIFE: true }],
  // detect Promise misuse in event handlers
  "@typescript-eslint/no-misused-promises": [
    "error",
    {
      checksVoidReturn: {
        attributes: false, // allow onClick={() => void asyncFn()}
        properties: true,
        inheritedMethods: true,
      },
    },
  ],
  // detect and remove unnecessary await (when await is used on a value that is not a Promise)
  // Some external libraries may have incorrect type definitions, so use warn instead of error
  "@typescript-eslint/await-thenable": "warn",
  // detect when await is not used in an async function
  "@typescript-eslint/require-await": "error",
  // React components don't need explicit return types (JSX.Element is inferred)
  "@typescript-eslint/explicit-function-return-type": "off",
  // Disable @typescript-eslint/no-unused-vars (imports and vars handled by unused-imports plugin)
  "@typescript-eslint/no-unused-vars": "off",
  // Automatically remove unused imports and detect unused variables
  "unused-imports/no-unused-imports": "error",
  "unused-imports/no-unused-vars": [
    "warn",
    {
      varsIgnorePattern: "^_",
      argsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    },
  ],
  // Prevent unnecessary type assertions
  // Detect when type assertion is used on a value that already has the same type
  "@typescript-eslint/no-unnecessary-type-assertion": "error",
  // Prevent revalidate from using expressions (must be numeric literal for Next.js route config parsing)
  "no-restricted-syntax": [
    "error",
    {
      message:
        "revalidate must be a numeric literal, not an expression. Next.js cannot parse expressions in route segment config.",
      selector:
        "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name='revalidate'] > BinaryExpression",
    },
    {
      message:
        "revalidate must be a numeric literal, not a function call. Next.js cannot parse function calls in route segment config.",
      selector:
        "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name='revalidate'] > CallExpression",
    },
    {
      message:
        "revalidate must be a numeric literal, not a member expression. Next.js cannot parse member expressions in route segment config.",
      selector:
        "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name='revalidate'] > MemberExpression",
    },
  ],
};

// TypeScript rules for test files (more lenient)
const testTypescriptRules = {
  // distinguish type import and value import
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
  // detect and remove unnecessary await (when await is used on a value that is not a Promise)
  // expect(...).rejects and dynamic import are actually returning a Promise, so only warn
  "@typescript-eslint/await-thenable": ["warn"],
  // Next.js img element rule not applicable in tests
  "@next/next/no-img-element": "off",
  // Disable @typescript-eslint/no-unused-vars (imports and vars handled by unused-imports plugin)
  "@typescript-eslint/no-unused-vars": "off",
  // Automatically remove unused imports and detect unused variables
  "unused-imports/no-unused-imports": "error",
  "unused-imports/no-unused-vars": [
    "warn",
    {
      varsIgnorePattern: "^_",
      argsIgnorePattern: "^_",
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
    "unused-imports": pluginUnusedImports,
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
    "unused-imports": pluginUnusedImports,
  },
  rules: testTypescriptRules,
};

const eslintConfig = defineConfig([ignoreConfig, baseConfig, mobileHookConfig, typescriptConfig, testTypescriptConfig]);

export default eslintConfig;
