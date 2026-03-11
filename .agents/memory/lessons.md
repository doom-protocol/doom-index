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

- ユーザーが「source code は触らずに deployment / platform 設定で解決したい」と明示した場合は、まず Cloudflare / Wrangler / CI の build-time env 設定を確認する。source 側の import 境界修正を先に進めない。

- reviewer が build-time env と runtime env の不整合を指摘しても、ユーザーが CI の設定ミスを特定したなら `skipValidation` のような緩和へ戻らない。まず workflow / dashboard / build settings を正し、その前提で source は strict に保つ。

- OpenNext Cloudflare のローカル開発では、公式 how-to が `next dev` を示しているなら通常の `dev` script を `build + preview` にしない。Workers preview は別用途として残し、日常開発フローを不要に重くしない。

- この repo のローカル env の正は `.dev.vars`、共有テンプレートは `.example.vars`。ユーザーがその運用へ切り替えた後は `.env.local` や `.env.example` を再導入せず、Bun scripts も同じファイル名に揃える。

- ただし Next.js の `dev` 起動だけは例外で、ユーザーが `.env.local -> .dev.vars` の symlink を選ぶなら、その標準機構を優先する。wrapper script や bootstrap を足して同じことを再実装しない。

- `next.config.ts` では shallow helper を増やさない。`isNextDevCommand` や `mergeResolve` のような 1 回しか使わない小さな抽象化より、条件と代入をその場で短く書くほうを優先する。

- `next.config.ts` では小さな helper を量産しない。条件分岐や alias マージが 1 箇所で完結するなら、その場で読める形を優先し、`composePlugins` や `mergeResolve` のような抽象化は入れない。

- カメラやドラッグ境界のバグ修正では、ユーザーが「可動域を超えたらその入力全体を無効化したい」と言った場合、軸ごとの部分 clamp を正解だと決めつけない。まず「直前の合法状態へ丸ごと戻すべきか」を要件として確認し、その仕様で回帰テストを書く。

- カメラ境界の要件で「奥の壁の後ろに行かない」「後ろには向かない」と言われたら、物理壁追加で解決しようとしない。OrbitControls の可動域条件として `position/target` の Z 上限と「camera stays in front of target」を先にモデル化する。

- 定期 polling する query を 3D scene や texture 更新の親にぶら下げるときは、データ内容が同じなら参照も保つ。TanStack Query の `structuralSharing` を使って同一 painting の object identity を固定し、周期 refetch で無駄な scene rerender を起こさない。

- 1 秒ごとの countdown や progress 表示は React state で持たない。見た目の数字や width だけを変える用途なら ref と DOM 更新に落として、重い scene と同じ画面で 1Hz の React rerender を作らない。

- ギャラリーの「壁」要件は OrbitControls の可動域だけで満たしていると決めつけない。ユーザーが不要と言った壁が残っていたら、まず `GalleryRoom` の mesh 構成も確認して、境界ロジックと部屋ジオメトリのどちらの話かを切り分ける。

- `NEXT_PUBLIC_R2_URL` の本番値は、ユーザー指定があるまで `"/api/r2"` を既定として扱う。R2 公開ドメインが使えそうでも、runtime env の修正で勝手に `storage.doomindex.fun` へ変えない。
