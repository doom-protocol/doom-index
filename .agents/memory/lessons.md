# Lessons

- ESLint 設定更新では、shared config の厳しいルールを `off` で相殺しない。まず参照どおりに設定を組み、既存コードを実装修正して適合させる。

- When adding repo hooks, prefer the project's existing `bun run ...` scripts over direct `bunx ...` commands unless the user asks for direct binaries.

- ユーザーが不要と言った `next.config` や `tsconfig` のようなビルド設定向け回帰テストは追加しない。設定修正は最小差分で実装し、検証は実際の `build` / `typecheck` / `lint` で行う。

- `.dev.vars` は legacy 扱いなので新規変更で使わない。テスト系は `.env.example`、実運用ローカルスクリプトは `.env.local` に寄せる。

- GitHub Actions の汎用 `build` job は追加しない。Cloudflare Workers の build check を正として扱い、CI には必要な品質ゲートだけ残す。

- `NextImage` を含む既存実装は、ユーザー指示なしに素の `img` へ置き換えない。テスト失敗は event の起こし方や mock で解消する。
