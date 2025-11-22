# Implementation Tasks — doom-index

## Phase 0: Cloudflare 環境セットアップ

### Task 0.1: Cloudflare Workers プロジェクト初期化

- **Description**: `wrangler` CLI をインストールし、Cloudflare Workers プロジェクトを初期化する。
- **Acceptance Criteria**:
  - `wrangler` CLI がグローバルまたはプロジェクトにインストールされている
  - `wrangler.toml` が作成され、基本設定（`name`, `compatibility_date`, `compatibility_flags`）が記載されている
  - `wrangler login` でCloudflare アカウントに認証済み
- **Dependencies**: なし
- **Estimated Effort**: 0.5h

### Task 0.2: Cloudflare R2 バケット作成

- **Description**: Cloudflare Dashboard または `wrangler` CLI で R2 バケットを作成し、`wrangler.toml` に R2 Binding を設定する。
- **Acceptance Criteria**:
  - R2 バケット（例: `doom-index-storage`）が作成されている
  - `wrangler.toml` の `[[r2_buckets]]` セクションに `binding = "R2_BUCKET"`, `bucket_name = "doom-index-storage"` が記載されている
  - ローカル開発用に `wrangler dev` で R2 エミュレータが動作する
- **Dependencies**: Task 0.1
- **Estimated Effort**: 0.5h

### Task 0.3: Cloudflare Workers Secrets 設定

- **Description**: 画像生成 Provider の API Key を Cloudflare Workers Secrets に保存し、ローカル開発用に `.dev.vars` を作成する。
- **Acceptance Criteria**:
  - `wrangler secret put PROVIDER_API_KEY` で Secret が保存されている
  - `.dev.vars` ファイルが作成され、`PROVIDER_API_KEY=xxx` が記載されている
  - `.gitignore` に `.dev.vars` が追加されている
- **Dependencies**: Task 0.1
- **Estimated Effort**: 0.25h

### Task 0.4: @opennextjs/cloudflare インストールと設定

- **Description**: `@opennextjs/cloudflare` をインストールし、`open-next.config.ts` と `wrangler.toml` を Next.js 用に設定する。
- **Acceptance Criteria**:
  - `@opennextjs/cloudflare` が `package.json` の `devDependencies` に追加されている
  - `open-next.config.ts` が作成され、`defineCloudflareConfig()` が定義されている
  - `wrangler.toml` に `main = ".open-next/worker.js"`, `compatibility_flags = ["nodejs_compat"]`, `assets.directory = ".open-next/assets"` が記載されている
  - `package.json` の `scripts` に `"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview"`, `"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"` が追加されている
- **Dependencies**: Task 0.1
- **Estimated Effort**: 1h

## Phase 1: lib 層の Cloudflare 対応

### Task 1.1: lib/r2.ts の実装

- **Description**: Vercel Blob の `lib/blob.ts` を Cloudflare R2 用の `lib/r2.ts` に置き換える。
- **Acceptance Criteria**:
  - `lib/r2.ts` が作成され、`putJsonR2`, `getJsonR2`, `putImageR2`, `getJsonFromPublicUrl` が実装されている
  - Workers 環境では R2 Binding（`R2Bucket`）を使用し、Next.js 環境では公開 URL 経由で `fetch` を使用する
  - すべての関数が `Result<T, AppError>` を返す
  - `lib/blob.ts` が削除または非推奨化されている
- **Dependencies**: Task 0.2
- **Estimated Effort**: 2h
- **Files**:
  - `src/lib/r2.ts` (新規作成)
  - `src/lib/blob.ts` (削除または非推奨)

### Task 1.2: lib/dexScreener.ts の Workers 互換性確認

- **Description**: 既存の `lib/dexScreener.ts` が Cloudflare Workers で動作することを確認し、必要に応じて修正する。
- **Acceptance Criteria**:
  - `fetchPriceUsdByToken` が `fetch` API のみを使用し、Node.js 固有の API を使用していない
  - Workers 環境で実行してもエラーが発生しない
  - `Result<number, AppError>` を返す
- **Dependencies**: なし
- **Estimated Effort**: 0.5h
- **Files**:
  - `src/lib/dexScreener.ts` (確認・修正)

### Task 1.3: lib/providers の Workers 互換化

- **Description**: 画像生成 Provider（Runware/Replicate/OpenAI）を Workers 互換の `fetch` ベース実装に変更する。
- **Acceptance Criteria**:
  - `lib/providers/runware.ts`, `lib/providers/replicate.ts`, `lib/providers/openai.ts` が `fetch` API のみを使用している
  - SDK（`@runware/sdk-js` など）を使用せず、HTTP API を直接呼び出している
  - すべての Provider が `ImageProvider` インターフェースを実装している
  - `Result<ImageResponse, AppError>` を返す
- **Dependencies**: なし
- **Estimated Effort**: 3h
- **Files**:
  - `src/lib/providers/runware.ts` (修正)
  - `src/lib/providers/replicate.ts` (修正)
  - `src/lib/providers/openai.ts` (修正)
  - `src/lib/providers/index.ts` (修正)

### Task 1.4: lib/pure の Workers 互換性確認

- **Description**: `lib/pure` の純関数群が Cloudflare Workers で動作することを確認する。
- **Acceptance Criteria**:
  - `normalize.ts`, `quantize.ts`, `mapping.ts`, `prompt.ts`, `seed.ts`, `paramsHash.ts`, `filename.ts`, `time.ts` が Workers 環境で動作する
  - Node.js 固有の API（`fs`, `path` など）を使用していない
  - すべての関数が純粋関数として実装されている
- **Dependencies**: なし
- **Estimated Effort**: 1h
- **Files**:
  - `src/lib/pure/*.ts` (確認・修正)

## Phase 2: services 層の R2 対応

### Task 2.1: services/state.ts の R2 対応

- **Description**: `StateService` を R2 Binding に対応させる。
- **Acceptance Criteria**:
  - `StateService` のすべてのメソッドが `R2Bucket` を第一引数として受け取る
  - `storeImage`, `readImage`, `readGlobalState`, `writeGlobalState`, `writeTokenStates` が R2 API を使用している
  - `lib/r2.ts` の関数を使用している
  - `Result<T, AppError>` を返す
- **Dependencies**: Task 1.1
- **Estimated Effort**: 2h
- **Files**:
  - `src/services/state.ts` (修正)

### Task 2.2: services/market-cap.ts の確認

- **Description**: `MarketCapService` が Workers 環境で動作することを確認する。
- **Acceptance Criteria**:
  - `getMcMap`, `roundMc4` が Workers 環境で動作する
  - `lib/dexScreener.ts` を使用している
  - `Result<McMap, AppError>` を返す
- **Dependencies**: Task 1.2
- **Estimated Effort**: 0.5h
- **Files**:
  - `src/services/market-cap.ts` (確認・修正)

### Task 2.3: services/prompt.ts の R2 対応

- **Description**: `PromptService` を R2 Binding に対応させる。
- **Acceptance Criteria**:
  - `composePrompt` が `R2Bucket` を引数として受け取る
  - R2 から `prompts/registry.json` を読み取り、`PromptVersion` を取得する
  - `lib/pure` の関数を使用してプロンプト・seed・視覚パラメータを生成する
  - `Result<PromptComposition, AppError>` を返す
- **Dependencies**: Task 1.1, Task 1.4
- **Estimated Effort**: 2h
- **Files**:
  - `src/services/prompt.ts` (修正)

### Task 2.4: services/generation.ts の R2 対応

- **Description**: `GenerationService` を R2 Binding と Workers Secrets に対応させる。
- **Acceptance Criteria**:
  - `runMinuteGeneration` が `R2Bucket` と `apiKey` を引数として受け取る
  - `MarketCapService`, `PromptService`, `ImageProvider`, `StateService` を呼び出す
  - ハッシュ比較で生成/スキップを分岐する
  - 生成成功時に R2 に画像と state を保存する
  - `Result<MinuteEvaluation, AppError>` を返す
- **Dependencies**: Task 2.1, Task 2.2, Task 2.3, Task 1.3
- **Estimated Effort**: 3h
- **Files**:
  - `src/services/generation.ts` (修正)

## Phase 3: Cloudflare Workers Cron 実装

### Task 3.1: workers/cron.ts の作成

- **Description**: Cloudflare Workers Cron Triggers のエントリポイントを作成する。
- **Acceptance Criteria**:
  - `workers/cron.ts` が作成され、`scheduled` ハンドラが実装されている
  - `env.R2_BUCKET` と `env.PROVIDER_API_KEY` を `GenerationService.runMinuteGeneration()` に渡す
  - 成功時は `console.info` でログ出力、失敗時は `console.error` でログ出力
  - `durationMs` を計測してログに含める
- **Dependencies**: Task 2.4
- **Estimated Effort**: 1.5h
- **Files**:
  - `workers/cron.ts` (新規作成)

### Task 3.2: wrangler.toml の Cron Triggers 設定

- **Description**: `wrangler.toml` に Cron Triggers の設定を追加する。
- **Acceptance Criteria**:
  - `[triggers]` セクションに `crons = ["* * * * *"]` が記載されている
  - `wrangler dev` でローカル Cron をテストできる
  - `wrangler deploy` で Cloudflare Workers にデプロイできる
- **Dependencies**: Task 3.1
- **Estimated Effort**: 0.5h
- **Files**:
  - `wrangler.toml` (修正)

### Task 3.3: Workers ローカルテスト

- **Description**: `wrangler dev` でローカル Workers を起動し、Cron ハンドラをテストする。
- **Acceptance Criteria**:
  - `wrangler dev` で Workers が起動する
  - `wrangler dev --test-scheduled` で Cron ハンドラが手動実行できる
  - R2 エミュレータで画像と state が保存される
  - ログが正しく出力される
- **Dependencies**: Task 3.2
- **Estimated Effort**: 1h

## Phase 4: Next.js API Routes の R2 対応

### Task 4.1: app/api/mc/route.ts の確認

- **Description**: `/api/mc` が Cloudflare Pages で動作することを確認する。
- **Acceptance Criteria**:
  - `MarketCapService.getMcMap()` と `roundMc4()` を使用している
  - DexScreener API を直接呼び出している（R2 不要）
  - 失敗時は各値 0 のフォールバックで HTTP 200 を返す
  - Cloudflare Pages でデプロイ後に動作する
- **Dependencies**: Task 2.2
- **Estimated Effort**: 0.5h
- **Files**:
  - `src/app/api/mc/route.ts` (確認・修正)

### Task 4.2: app/api/tokens/[ticker]/route.ts の R2 対応

- **Description**: `/api/tokens/[ticker]` を R2 公開 URL 経由で state を取得するように変更する。
- **Acceptance Criteria**:
  - R2 公開 URL（`https://your-bucket.r2.dev/state/{ticker}.json`）から `fetch` で取得する
  - `lib/r2.ts` の `getJsonFromPublicUrl` を使用する
  - 存在すれば HTTP 200、なければ HTTP 204 を返す
  - Cloudflare Pages でデプロイ後に動作する
- **Dependencies**: Task 1.1
- **Estimated Effort**: 1h
- **Files**:
  - `src/app/api/tokens/[ticker]/route.ts` (修正)

### Task 4.3: app/share/[ticker]/page.tsx の R2 対応

- **Description**: `/share/[ticker]` を R2 公開 URL 経由で state を取得し、OGP メタを生成するように変更する。
- **Acceptance Criteria**:
  - R2 公開 URL から `state/{ticker}.json` を取得する
  - `thumbnailUrl` を OG/Twitter meta に設定する
  - 存在しない場合はデフォルトメタ（プレースホルダ画像）を返す
  - `cache-control: no-store` または `max-age ≤ 60` を設定する
  - Cloudflare Pages でデプロイ後に動作する
- **Dependencies**: Task 1.1
- **Estimated Effort**: 1.5h
- **Files**:
  - `src/app/share/[ticker]/page.tsx` (修正または新規作成)

### Task 4.4: app/api/cron/route.ts の削除

- **Description**: Next.js の `/api/cron` を削除し、Cloudflare Workers Cron に置き換える。
- **Acceptance Criteria**:
  - `src/app/api/cron/route.ts` が削除されている
  - `vercel.json` の Cron 設定が削除されている
  - ドキュメントが更新されている
- **Dependencies**: Task 3.1
- **Estimated Effort**: 0.25h
- **Files**:
  - `src/app/api/cron/route.ts` (削除)
  - `vercel.json` (修正または削除)

## Phase 5: Frontend の確認と調整

### Task 5.1: hooks/use-mc.ts の確認

- **Description**: `useMc` フックが `/api/mc` を正しく呼び出していることを確認する。
- **Acceptance Criteria**:
  - `@tanstack/react-query` の `useQuery` を使用している
  - `refetchInterval: 10000`, `staleTime: 10000`, `retry: 1` が設定されている
  - エラー時は各値 0 のフォールバックを返す
- **Dependencies**: Task 4.1
- **Estimated Effort**: 0.5h
- **Files**:
  - `src/hooks/use-mc.ts` (確認・修正)

### Task 5.2: hooks/use-token-image.ts の確認

- **Description**: `useTokenImage` フックが `/api/tokens/[ticker]` を正しく呼び出していることを確認する。
- **Acceptance Criteria**:
  - `@tanstack/react-query` の `useQuery` を使用している
  - `cacheTime: 60000`, `refetchOnWindowFocus: false` が設定されている
  - `thumbnailUrl` の変化を検知してテクスチャを更新する
- **Dependencies**: Task 4.2
- **Estimated Effort**: 0.5h
- **Files**:
  - `src/hooks/use-token-image.ts` (確認・修正)

### Task 5.3: components/gallery の実装確認

- **Description**: `GalleryScene`, `CameraRig`, `Lights`, `FramedPainting` が設計通りに実装されていることを確認する。
- **Acceptance Criteria**:
  - `GalleryScene` が `@react-three/fiber` の `Canvas` を使用している
  - `CameraRig` が 800ms イージング遷移を実装している
  - `Lights` が `ambientLight 0.05` と `spotLight 3.0` を配置している
  - `FramedPainting` が GLB の `ImageAnchor` に Plane を配置し、テクスチャを適用している
- **Dependencies**: Task 5.2
- **Estimated Effort**: 2h
- **Files**:
  - `src/components/gallery/*.tsx` (確認・修正)

### Task 5.4: components/ui の実装確認

- **Description**: `TopBar`, `NavButtons`, `RealtimeDashboard` が設計通りに実装されていることを確認する。
- **Acceptance Criteria**:
  - `TopBar` が 1 分ゲージを `requestAnimationFrame` で実装している
  - `NavButtons` が「Dashboard へ」「Back」ボタンを提供している
  - `RealtimeDashboard` が `/api/mc` を 10 秒ごとに再取得している
- **Dependencies**: Task 5.1
- **Estimated Effort**: 1h
- **Files**:
  - `src/components/ui/*.tsx` (確認・修正)

## Phase 6: テストと検証

### Task 6.1: lib/pure の Unit Tests

- **Description**: `lib/pure` の純関数群の決定性テストを実装する。
- **Acceptance Criteria**:
  - `normalize`, `quantize`, `mapping`, `prompt`, `seed`, `paramsHash`, `filename` の Unit Tests が実装されている
  - 同一入力で同一出力を返すことを検証する
  - `bun run test` で全テストが通過する
- **Dependencies**: Task 1.4
- **Estimated Effort**: 2h
- **Files**:
  - `tests/lib/pure/*.test.ts` (新規作成または修正)

### Task 6.2: services の Integration Tests

- **Description**: `services` の Integration Tests を実装する。
- **Acceptance Criteria**:
  - `runMinuteGeneration` のモックテストが実装されている
  - `prevHash === nowHash` で skip することを検証する
  - 生成時に全トークン state が同一 URL を指すことを検証する
  - `bun run test` で全テストが通過する
- **Dependencies**: Task 2.4
- **Estimated Effort**: 3h
- **Files**:
  - `tests/services/*.test.ts` (新規作成または修正)

### Task 6.3: Workers Cron の E2E Test

- **Description**: `workers/cron.ts` の E2E テストを実装する。
- **Acceptance Criteria**:
  - `wrangler dev --test-scheduled` で Cron を手動実行できる
  - R2 に画像と state が保存されることを確認する
  - ログが正しく出力されることを確認する
- **Dependencies**: Task 3.3
- **Estimated Effort**: 2h
- **Files**:
  - `tests/workers/cron.test.ts` (新規作成)

### Task 6.4: Frontend の E2E Test

- **Description**: フロントエンドの E2E テストを実装する。
- **Acceptance Criteria**:
  - 1 分ゲージが 60,000ms で満了→リセットすることを検証する
  - カメラ遷移が 800ms 以内に完了することを検証する
  - スポットライトが中央額縁をターゲットすることを検証する
  - `/share/[ticker]` が最新画像 URL を OGP/Twitter meta へ反映することを検証する
- **Dependencies**: Task 5.3, Task 5.4
- **Estimated Effort**: 3h
- **Files**:
  - `tests/e2e/*.test.ts` (新規作成)

## Phase 7: デプロイと監視

### Task 7.1: Cloudflare Pages へのデプロイ

- **Description**: Next.js を Cloudflare Pages にデプロイする。
- **Acceptance Criteria**:
  - `opennextjs-cloudflare build` でビルドが成功する
  - `wrangler deploy` で Cloudflare Pages にデプロイできる
  - `*.pages.dev` または Custom Domain でアクセスできる
  - `/api/mc`, `/api/tokens/[ticker]`, `/share/[ticker]` が動作する
- **Dependencies**: Task 4.1, Task 4.2, Task 4.3
- **Estimated Effort**: 1h

### Task 7.2: Cloudflare Workers Cron のデプロイ

- **Description**: Cloudflare Workers Cron を本番環境にデプロイする。
- **Acceptance Criteria**:
  - `wrangler deploy` で Workers がデプロイされる
  - Cron Triggers が毎分実行される
  - Cloudflare Logs で実行ログを確認できる
  - R2 に画像と state が保存される
- **Dependencies**: Task 3.2
- **Estimated Effort**: 0.5h

### Task 7.3: Cloudflare Logs の監視設定

- **Description**: Cloudflare Logs で Workers の実行ログを監視する設定を行う。
- **Acceptance Criteria**:
  - Cloudflare Dashboard で Logs を確認できる
  - `generation.skip` / `generation.generated` のログが出力される
  - エラーログが出力される
  - 初回 24 時間はログ監視を強化する
- **Dependencies**: Task 7.2
- **Estimated Effort**: 0.5h

### Task 7.4: R2 公開 URL の設定

- **Description**: R2 バケットに Custom Domain を設定し、公開 URL を確定する。
- **Acceptance Criteria**:
  - R2 バケットに Custom Domain が設定されている（または `r2.dev` URL を使用）
  - `lib/r2.ts` の `putImageR2` で正しい公開 URL を返す
  - Next.js API Routes が公開 URL から state を取得できる
- **Dependencies**: Task 0.2
- **Estimated Effort**: 1h

## Phase 8: ドキュメントと最終確認

### Task 8.1: README の更新

- **Description**: README を Cloudflare Workers ベースに更新する。
- **Acceptance Criteria**:
  - Cloudflare Workers、Cloudflare R2、Cloudflare Pages の説明が追加されている
  - `wrangler` CLI のインストール手順が記載されている
  - ローカル開発手順（`wrangler dev`）が記載されている
  - デプロイ手順（`opennextjs-cloudflare build`, `wrangler deploy`）が記載されている
- **Dependencies**: Task 7.1, Task 7.2
- **Estimated Effort**: 1h
- **Files**:
  - `README.md` (修正)

### Task 8.2: 開発要件定義書の最終確認

- **Description**: `docs/development-spec.md` が最新の実装と一致していることを確認する。
- **Acceptance Criteria**:
  - Cloudflare Workers、R2、Pages の説明が正確である
  - ディレクトリ構造が実装と一致している
  - コード例が実装と一致している
- **Dependencies**: Task 7.1, Task 7.2
- **Estimated Effort**: 0.5h
- **Files**:
  - `docs/development-spec.md` (確認・修正)

### Task 8.3: 完了基準（DoD）の確認

- **Description**: 完了基準（DoD）がすべて満たされていることを確認する。
- **Acceptance Criteria**:
  - 1 分ごとに `workers/cron.ts` が走り、MC が前回と同一なら skip、差異があれば合成 1 枚を生成する
  - 全トークン state が同一 `thumbnailUrl` を指す
  - 3D 館は暗闇＋真上スポット 1 基で正面の 1 枚が浮かぶ
  - 右側のダッシュ額縁にリアルタイム MC（10s 更新）
  - ローカル `exp-generate.ts` で任意パラメータ生成・seed 再現が可能
  - `services` は `neverthrow.Result` で実装され、Workers/API 層は単純写像のみ
  - `lib` に余計な `httpJson`/`getJson` ラッパは存在しない
  - `wrangler.toml` で Cron Triggers、R2 Binding、Secrets が正しく設定されている
  - Cloudflare Pages で Next.js がデプロイされ、R2 公開 URL から state を取得できる
- **Dependencies**: All previous tasks
- **Estimated Effort**: 1h

## Summary

- **Total Tasks**: 38
- **Estimated Total Effort**: 44.75h
- **Critical Path**: Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 6 → Phase 7
- **Parallel Work Opportunities**:
  - Phase 1 (lib 層) と Phase 5 (Frontend) は並行作業可能
  - Phase 6 (テスト) は各 Phase 完了後に並行作業可能
