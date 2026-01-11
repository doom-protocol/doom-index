import pluginUnusedImports from "eslint-plugin-unused-imports";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { globalIgnores } from "eslint/config";
import type { Linter } from "eslint";
import tseslint from "typescript-eslint";
import reactYouMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect";

const typescriptRules: Partial<Linter.RulesRecord> = {
  // Object shorthand syntax
  "object-shorthand": [2],
  // Distinguish type import and value import
  "@typescript-eslint/consistent-type-imports": [
    2,
    {
      prefer: "type-imports",
      fixStyle: "inline-type-imports",
    },
  ],
  // Don't throw promises
  "@typescript-eslint/no-floating-promises": [2, { ignoreIIFE: true }],
  // Detect Promise misuse in event handlers
  "@typescript-eslint/no-misused-promises": [
    2,
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
  "@typescript-eslint/await-thenable": [1],
  // Detect when await is not used in an async function
  "@typescript-eslint/require-await": [2],
  // Require explicit return types for module boundary functions
  "@typescript-eslint/explicit-module-boundary-types": [1],
  // Prevent unnecessary type assertions
  // Detect when type assertion is used on a value that already has the same type
  "@typescript-eslint/no-unnecessary-type-assertion": [2],
  // Automatically remove unused imports and detect unused variables
  "unused-imports/no-unused-imports": [2],
  "unused-imports/no-unused-vars": [
    1,
    {
      varsIgnorePattern: "^_",
      argsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    },
  ],
};

const reactRules: Partial<Linter.RulesRecord> = {
  // React JSX rules (override Next.js defaults if needed)
  "react/jsx-curly-brace-presence": [2],
  // Enforce arrow function for function components (prefer React.FC style)
  // e.g., const Component: React.FC<Props> = (props) => { ... }
  "react/function-component-definition": [
    2,
    {
      namedComponents: "arrow-function",
      unnamedComponents: "arrow-function",
    },
  ],
};

const nextRules: Partial<Linter.RulesRecord> = {
  // Prevent using arithmetic expressions with two numeric literals in const declarations
  // e.g., const hour = 60 * 60 → should be const hour = 3600
  // Note: Only targets "Literal op Literal" patterns, not "variable op Literal" (e.g., now - 90000 is OK)
  "no-restricted-syntax": [
    2,
    {
      message: "Use numeric literals instead of expressions in const declarations (e.g., use 3600 instead of 60 * 60)",
      selector:
        "VariableDeclaration[kind='const'] > VariableDeclarator > BinaryExpression:matches([operator='*'], [operator='/'], [operator='+'], [operator='-']):has(> Literal.left):has(> Literal.right)",
    },
  ],
};

const nextAppRouterRules: Partial<Linter.RulesRecord> = {
  "react/function-component-definition": [
    2,
    {
      namedComponents: ["function-declaration", "arrow-function"],
      unnamedComponents: "arrow-function",
    },
  ],
};

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
  rules: typescriptRules,
};

// React JSX specific rules
const reactConfig = {
  files: ["**/*.tsx"],
  rules: reactRules,
};

const nextConfig = {
  files: ["**/app/**/page.tsx"],
  rules: nextRules,
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
  rules: nextAppRouterRules,
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

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  typescriptConfig,
  reactConfig,
  nextConfig,
  nextAppRouterConfig, // Must come after reactConfig to override
  reactYouMightNotNeedAnEffect.configs.strict,
  ignoreConfig,
];

export default eslintConfig;
