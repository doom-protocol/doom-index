import { defineConfig } from "oxfmt";

export default defineConfig({
  semi: true,
  singleQuote: false,
  printWidth: 120,
  sortTailwindcss: {},
  sortPackageJson: false,
  ignorePatterns: [".claude/worktrees/**"],
});
