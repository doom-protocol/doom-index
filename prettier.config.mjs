/** @type {import('prettier').Config} */
export default {
  semi: true,
  singleQuote: false,
  printWidth: 120,
  trailingComma: "all",
  arrowParens: "avoid",
  bracketSpacing: true,
  tabWidth: 2,
  useTabs: false,
  plugins: ["prettier-plugin-organize-imports", "prettier-plugin-tailwindcss"],
};
