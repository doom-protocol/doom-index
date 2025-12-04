import pluginUnusedImports from "eslint-plugin-unused-imports";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// TypeScript configuration (type-aware rules and project-specific rules)
const typescriptConfig = {
  files: ["**/*.ts", "**/*.tsx"],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: "./tsconfig.json",
    },
  },
  plugins: {
    "unused-imports": pluginUnusedImports,
  },
  rules: {
    // Object shorthand syntax
    "object-shorthand": "error",
    // Distinguish type import and value import
    "@typescript-eslint/consistent-type-imports": [
      "error",
      {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
      },
    ],
    // Don't throw promises
    "@typescript-eslint/no-floating-promises": ["error", { ignoreIIFE: true }],
    // Detect Promise misuse in event handlers
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
    // Detect and remove unnecessary await (when await is used on a value that is not a Promise)
    // Some external libraries may have incorrect type definitions, so use warn instead of error
    "@typescript-eslint/await-thenable": "warn",
    // Detect when await is not used in an async function
    "@typescript-eslint/require-await": "error",
    // Require explicit return types for module boundary functions
    "@typescript-eslint/explicit-module-boundary-types": "warn",
    // Prevent unnecessary type assertions
    // Detect when type assertion is used on a value that already has the same type
    "@typescript-eslint/no-unnecessary-type-assertion": "error",
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
  },
};

// React JSX specific rules
const reactConfig = {
  files: ["**/*.tsx"],
  rules: {
    // React JSX rules (override Next.js defaults if needed)
    "react/jsx-curly-brace-presence": "error",
    // Enforce arrow function for function components (prefer React.FC style)
    // e.g., const Component: React.FC<Props> = (props) => { ... }
    "react/function-component-definition": [
      "error",
      {
        namedComponents: "arrow-function",
        unnamedComponents: "arrow-function",
      },
    ],
  },
};

const nextConfig = {
  files: ["**/app/**/page.tsx"],
  rules: {
    // Prevent using arithmetic expressions with two numeric literals in const declarations
    // e.g., const hour = 60 * 60 → should be const hour = 3600
    // Note: Only targets "Literal op Literal" patterns, not "variable op Literal" (e.g., now - 90000 is OK)
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
};

// Next.js App Router specific files (page.tsx, layout.tsx, etc.)
// Allow function declarations for NextPage type usage
const nextAppRouterConfig = {
  files: [
    "**/page.tsx",
    "**/layout.tsx",
    "**/loading.tsx",
    "**/error.tsx",
    "**/not-found.tsx",
    "**/template.tsx",
    "**/default.tsx",
  ],
  rules: {
    "react/function-component-definition": [
      "error",
      {
        namedComponents: ["function-declaration", "arrow-function"],
        unnamedComponents: "arrow-function",
      },
    ],
  },
};

// Ignore patterns (extends Next.js defaults)
const ignoreConfig = globalIgnores([
  // Default ignores from eslint-config-next:
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
  // Additional ignores:
  ".open-next/**",
  ".wrangler/**",
  ".cursor/**",
  ".kiro/**",
  "public/**",
]);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  typescriptConfig,
  reactConfig,
  nextConfig,
  nextAppRouterConfig, // Must come after reactConfig to override
  ignoreConfig,
]);

export default eslintConfig;
