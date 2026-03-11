# Lessons

- ESLint 設定更新では、shared config の厳しいルールを `off` で相殺しない。まず参照どおりに設定を組み、既存コードを実装修正して適合させる。

- When adding repo hooks, prefer the project's existing `bun run ...` scripts over direct `bunx ...` commands unless the user asks for direct binaries.

- ユーザーが不要と言った `next.config` や `tsconfig` のようなビルド設定向け回帰テストは追加しない。設定修正は最小差分で実装し、検証は実際の `build` / `typecheck` / `lint` で行う。

- `.dev.vars` は legacy 扱いなので新規変更で使わない。テスト系は `.env.example`、実運用ローカルスクリプトは `.env.local` に寄せる。

- GitHub Actions の汎用 `build` job は追加しない。Cloudflare Workers の build check を正として扱い、CI には必要な品質ゲートだけ残す。

- `NextImage` を含む既存実装は、ユーザー指示なしに素の `img` へ置き換えない。テスト失敗は event の起こし方や mock で解消する。

- `declare module "*.css" {}` のような空の宣言で型エラーを塞がない。型や import 境界の根本原因を直し、workaround 風の修正は見つけ次第戻す。

- Bun 管理の repo では依存確認やバージョン確認にも `npm` を使わない。`bun pm` や `bun install`、必要なら `bunx` を優先し、`package-lock.json` を発生させうる操作を避ける。

- 外部依存の warning を env var で suppress する前に、lockfile と `node_modules` の再解決で根本解消するかを先に確認する。warning が自然に消えるなら script の環境変数は追加しない。

- PR 用に代替ブランチを切った場合は、作業完了前に 1 本へ統合して余分な branch を消す。似た名前の branch を並行で残したまま PR 作成フェーズへ進めない。

- npm script や workflow に直接 env var を差し込む workaround は避ける。Cloudflare/Next/OpenNext の build 問題は build-time 実行経路を正して解決し、必要なら理由をコメントで残す。

- workaround を消すときは CI pass だけでなく bundle size の副作用も確認する。server bundle を軽くしていた仕組みを外すなら、何が代わりに入るのかを計測してから最小の境界修正に置き換える。

- ユーザーが source を simple に保ちたいと言ったときは、dynamic import や境界変更を source に散らさず、可能なら `next.config.ts` など build/bundle 設定に最適化を集約する。

- `force-dynamic` や `typeof window` ガードは source の workaround になりやすい。入れる前に本当にその route が dynamic である必要があるか、client が server-only code を参照していないかを先に正す。
