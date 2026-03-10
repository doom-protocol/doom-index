# Lessons

- ESLint 設定更新では、shared config の厳しいルールを `off` で相殺しない。まず参照どおりに設定を組み、既存コードを実装修正して適合させる。

- When adding repo hooks, prefer the project's existing `bun run ...` scripts over direct `bunx ...` commands unless the user asks for direct binaries.
