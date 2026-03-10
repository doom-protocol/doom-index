# Requirements Document

## Introduction

DOOM INDEX は、Solana 上の 8 種類の指標トークン（`$CO2 / $ICE / $FOREST / $NUKE / $MACHINE / $PANDEMIC / $FEAR / $HOPE`）の Market Cap を 1 分単位で取得し、その瞬間の世界の状態を 1 枚の生成絵画として提示するエッジネイティブなアート体験である。ビジネス価値は、トレード誘発による手数料収益と超低コスト運用の両立、ならびに共有性の高いビジュアル体験による継続的な流入にある。

技術スタックは Cloudflare Workers（Cron Triggers で 1 分間隔実行）、Cloudflare R2（画像・state 永続化）、Cloudflare Pages（Next.js ホスティング with @opennextjs/cloudflare）を採用し、Vercel の Cron 制約（1日1回上限）を回避する。フロントエンドは React Three Fiber と Three.js を用いた暗闇の美術館を再現し、React Query によるリアルタイム同期で最新状態を提示する。

## Requirements

### Requirement 1: 指標トークン市場データ統合

**Objective:** As a Data Steward, I want comprehensive market cap snapshots for the configured tokens, so that the system can drive deterministic prompt inputs.

#### Acceptance Criteria

1. WHEN Dexscreener API が `$CO2` から `$HOPE` までの各トークンにレスポンスしたとき THEN Doom Index Core SHALL 各トークンの USD 建て market cap を最大流動性ペアから算出する。
2. IF Dexscreener API 呼び出しが失敗したとき THEN Doom Index Core SHALL 当該トークンの market cap を 0 としてマップ生成を継続する。
3. WHILE 8 トークンの market cap マップを構築している間 THE Doom Index Core SHALL 全ての値を小数第 4 位で丸める。
4. WHERE トークン構成が定義されている設定リストが読み込まれたとき THEN Doom Index Core SHALL 8 トークンのみを対象としてデータ取得と正規化を実施する。

### Requirement 2: Cloudflare Workers Cron による分単位生成制御

**Objective:** As a Cron Worker, I want to execute generation logic every minute via Cloudflare Cron Triggers with skip logic, so that only one image per minute is ever produced when the on-chain state changes.

#### Acceptance Criteria

1. WHEN Cloudflare Cron Triggers が `wrangler.toml` の `crons = ["* * * * *"]` 設定に基づき毎分実行されたとき THEN Cron Worker SHALL `workers/cron.ts` の `scheduled` ハンドラを起動する。
2. WHEN `scheduled` ハンドラが起動したとき THEN Cron Worker SHALL R2 Binding（`env.R2_BUCKET`）を `GenerationService.runMinuteGeneration()` に渡し、丸め済み market cap マップから `nowHash` を算出する。
3. IF `nowHash` が R2 の `state/global.json` に保存された `prevHash` と等しいとき THEN Cron Worker SHALL 生成ジョブを呼び出さずにステータス `skipped` を Cloudflare Logs に記録する。
4. IF `nowHash` が `prevHash` と異なるとき THEN Cron Worker SHALL 同一分につき 1 件の生成ジョブのみを実行し Prompt Service と Image Provider を呼び出す。
5. WHILE 生成ジョブが進行中 THE Cron Worker SHALL 追加の生成リクエストを拒否し、成功した時点でのみ R2 の `state/global.json` の `prevHash` と `lastTs` を更新する。
6. WHERE 生成が成功したとき THEN Cron Worker SHALL 画像を R2 に保存し、公開 URL（`https://your-bucket.r2.dev/{key}` または Custom Domain）を発行する。

### Requirement 3: プロンプトと視覚パラメータ決定

**Objective:** As a Prompt Service, I want deterministic prompts and visual parameters derived from token metrics, so that each generated image reflects the configured influence axes.

#### Acceptance Criteria

1. WHEN Prompt Service がプロンプトを構築するとき THEN Prompt Service SHALL 8 トークンの丸め済み値と対応する影響軸（例: fogDensity, reflectivity, vegetationDensity, radiationGlow, mechanicalPattern, fractalDensity, shadowDepth, lightIntensity）を自然言語に埋め込む。
2. IF 正規化済み指標が提供されたとき THEN Prompt Service SHALL 各指標を 0〜1 の範囲にマッピングし生成パラメータ（skyTint, blueBalance, organicPattern, debrisIntensity, metallicRatio, bioluminescence, redHighlight, warmHue）へ書き戻す。
3. WHEN シード値を生成するとき THEN Prompt Service SHALL 分バケットとパラメータハッシュから決定論的な seed を算出する。
4. WHERE 画像生成リクエストを Image Provider に送信するとき THEN Prompt Service SHALL 幅 1024、高さ 1024、形式 webp の単一イメージ要求として送信メタデータを固定する。

### Requirement 4: Cloudflare R2 永続化と Next.js API 公開

**Objective:** As a Storage & API Layer, I want consistent persistence on R2 and read-only distribution via Next.js API Routes, so that clients always receive the canonical minute snapshot.

#### Acceptance Criteria

1. WHEN 画像生成が成功したとき THEN Cron Worker SHALL R2 Binding を使用して単一のバイナリ（webp 1024×1024）を保存し、公開 URL を発行した上で R2 の `state/global.json` の `prevHash` と `lastTs` を更新する。
2. IF 画像保存が失敗したとき THEN Cron Worker SHALL 既存の R2 グローバル state を保持し、エラーを Cloudflare Logs に記録する。
3. WHERE 各トークン state を更新するとき THEN Cron Worker SHALL R2 の `state/{ticker}.json` に 8 トークン全ての `thumbnailUrl` を同一の最新画像 URL に設定する。
4. WHEN Next.js API Routes の `/api/mc` が呼ばれたとき THEN API Layer SHALL DexScreener API を直接呼び出し、MC マップを HTTP 200 で返却する（失敗時は各値 0 のフォールバック）。
5. WHEN Next.js API Routes の `/api/tokens/[ticker]` が呼ばれたとき THEN API Layer SHALL R2 公開 URL（`https://your-bucket.r2.dev/state/{ticker}.json`）から `fetch` で取得し、存在すれば HTTP 200、なければ HTTP 204 を返却する。
6. WHERE `/share/[ticker]` が SSR されるとき THEN API Layer SHALL R2 から `state/{ticker}.json` を取得し、`thumbnailUrl` を OG/Twitter メタに設定する。

### Requirement 5: 3D ミュージアムレンダリング UI

**Objective:** As a Gallery Visitor, I want a deterministic 3D museum scene that highlights the latest artwork, so that the generated image is experienced as a focal exhibit.

#### Acceptance Criteria

1. WHEN `GalleryScene` コンポーネントがマウントされたとき THEN Gallery Frontend SHALL `@react-three/fiber` の `Canvas` を `camera={{ fov: 50, position: [0, 1.6, 1.0] }}`・`gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}` で初期化する。
2. IF `GalleryScene` が初期化されたとき THEN Gallery Frontend SHALL `ambientLight` 強度 `0.05` と `spotLight` 強度 `3.0`・位置 `[0, 3.0, -2.0]`・`angle=0.20`・`penumbra=0.6` を Three.js ノードとして配置し、`spotLight` の `target` を中央額縁へ向ける。
3. WHILE `GalleryScene` が描画を継続している間 THE Gallery Frontend SHALL `PaintingFrame` のマテリアルを `meshStandardMaterial` とし、床・壁メッシュの `color` を `#050505`、`roughness ≥ 0.8`、`metalness ≤ 0.1` に維持して中央作品を強調する。
4. WHERE `DashboardFrame` がレンダリングされるとき THEN Gallery Frontend SHALL `@react-three/drei` の `<Html transform>` で React UI を額縁内に投影し、表示領域を額縁のアスペクト比に合わせてスケール調整する。

### Requirement 6: インタラクティブ制御とデータ同期 UI

**Objective:** As a Dashboard User, I want responsive controls and real-time data binding, so that the gallery reacts instantly to token and generation state changes.

#### Acceptance Criteria

1. WHEN `useMc` フックが呼び出されたとき THEN Frontend Data Layer SHALL `@tanstack/react-query` の `useQuery(["mc"], fetcher, { refetchInterval: 10000, staleTime: 10000, retry: 1 })` を使用して `/api/mc` の結果を `RealtimeDashboard` に提供する。
2. IF `/api/mc` のレスポンスが HTTP 200 以外であるとき THEN Frontend Data Layer SHALL `useQuery` の `error` ステータスを設定し、8 トークン全ての値を `0` としたフォールバックを `RealtimeDashboard` に返す。
3. WHEN `useTokenImage` フックが `ticker` を受け取ったとき THEN Frontend Data Layer SHALL `useQuery(["token-image", ticker], fetcher, { cacheTime: 60000, refetchOnWindowFocus: false })` を利用し、`thumbnailUrl` の変化を検知したら `@react-three/drei` の `useTexture` で `PaintingFrame` のテクスチャを更新する。
4. WHERE `CameraRig.moveTo` が `'dashboard'` または `'painting'` を指示されたとき THEN UI Control Layer SHALL Three.js の `Vector3.lerp` を 16ms 間隔で呼び出し、800ms 以内に `position` と `lookAt` を定義済み座標へ補間する。

### Requirement 7: OGP 更新と共有（SSR）

**Objective:** As a Social Sharer, I want the share page to always reference the latest generated image, so that social platforms display the current artwork.

#### Acceptance Criteria

1. WHEN 新しい画像が生成され `thumbnailUrl` が更新されたとき THEN Share Layer SHALL `/share/[ticker]` の SSR メタに `og:image` と `twitter:image` として最新 `thumbnailUrl` を反映する。
2. IF `state/{ticker}.json` が存在しないとき THEN Share Layer SHALL `/share/[ticker]` で HTTP 204 を返さず、HTTP 200 でデフォルトメタ（プレースホルダ画像）を返す。
3. WHERE クローラが `/share/[ticker]` にアクセスしたとき THEN Share Layer SHALL `cache-control: no-store` ないし短期 `max-age ≤ 60` を付与して 1 分以内の更新を許容する。
4. WHEN 直前の生成から 1 分未満で再アクセスがあったとき THEN Share Layer SHALL `thumbnailUrl` の変更がある場合のみ新しい URL を返し、なければ同一 URL を返す。

### Requirement 8: GLB 額縁への画像はめ込み

**Objective:** As a Scene Implementer, I want to map the generated image texture precisely into the center of the GLB frame, so that the artwork appears flush within the frame without distortion.

#### Acceptance Criteria

1. WHEN 額縁 GLB を読み込むとき THEN Scene Layer SHALL `useGLTF` でノード `Frame.ImageAnchor`（中心基準・ローカル座標）を参照できる構造を前提とする。
2. IF `thumbnailUrl` が取得できたとき THEN Scene Layer SHALL `useTexture(thumbnailUrl)` を `sRGBEncoding` で読み込み、`anisotropy ≥ 4` を設定する。
3. WHEN テクスチャを額縁に表示するとき THEN Scene Layer SHALL `ImageAnchor` のローカルに `Plane` を生成し、内寸（`innerWidth`・`innerHeight`）に合わせてスケーリングし、アスペクト比を維持した上でレターボックスまたはカバーフィットを適用する。
4. WHERE Plane のマテリアルを設定するとき THEN Scene Layer SHALL `meshStandardMaterial` で `map=texture`・`roughness≈0.4`・`metalness≈0.0` を用い、ガンマ補正の二重適用が無いことを保証する。
5. WHILE `thumbnailUrl` が更新されている間 THE Scene Layer SHALL 既存テクスチャを破棄・置換し、フレーム落ちを起こさずに 1 フレーム以内で貼り替える。

### Requirement 9: Cloudflare Pages デプロイと @opennextjs/cloudflare 統合

**Objective:** As a Platform Engineer, I want Next.js to run on Cloudflare Pages with @opennextjs/cloudflare adapter, so that the application benefits from Cloudflare's global network and integrates seamlessly with Workers and R2.

#### Acceptance Criteria

1. WHEN プロジェクトをビルドするとき THEN Build System SHALL `@opennextjs/cloudflare` の `opennextjs-cloudflare build` コマンドを実行し、`.open-next/worker.js` と `.open-next/assets` を生成する。
2. IF `wrangler.toml` が存在するとき THEN Build System SHALL `main = ".open-next/worker.js"`、`compatibility_date ≥ "2024-09-23"`、`compatibility_flags = ["nodejs_compat"]`、`assets.directory = ".open-next/assets"` を含む設定を検証する。
3. WHEN `open-next.config.ts` が定義されているとき THEN Build System SHALL `defineCloudflareConfig()` でキャッシュ設定を適用し、R2 Binding や環境変数を Next.js ランタイムに注入する。
4. WHERE `wrangler deploy` が実行されたとき THEN Deployment System SHALL Cloudflare Pages に Next.js アプリケーションをデプロイし、`*.pages.dev` または Custom Domain でアクセス可能にする。
5. WHEN Next.js の API Routes が Cloudflare Pages で実行されるとき THEN Runtime SHALL `workerd` ランタイム（Workers 互換）で動作し、`nodejs_compat` フラグにより Node.js API（`Buffer`、`crypto`、`stream` など）が利用可能である。
6. IF R2 Binding が `wrangler.toml` で定義されているとき THEN Next.js API Routes SHALL `env.R2_BUCKET` を通じて R2 にアクセスできる（読み取り専用）。

### Requirement 10: Cloudflare Workers Secrets 管理

**Objective:** As a Security Engineer, I want sensitive API keys stored as Cloudflare Workers Secrets, so that credentials are never exposed in source code or public repositories.

#### Acceptance Criteria

1. WHEN 画像生成 Provider の API Key を設定するとき THEN Security Layer SHALL `wrangler secret put PROVIDER_API_KEY` コマンドで Cloudflare Workers Secrets に保存する。
2. IF Cron Worker が画像生成を実行するとき THEN Cron Worker SHALL `env.PROVIDER_API_KEY` から Secret を取得し、Image Provider API への `fetch` リクエストに含める。
3. WHERE `wrangler.toml` に Secret 参照が記載されているとき THEN Configuration SHALL Secret 名のみを記載し、値は含めない（例: `[vars]` セクションに Secret は記載しない）。
4. WHEN ローカル開発時に Secret が必要なとき THEN Developer SHALL `.dev.vars` ファイル（`.gitignore` に追加）に `PROVIDER_API_KEY=xxx` を記載し、`wrangler dev` が自動読み込みする。
5. IF Secret が更新されたとき THEN Security Layer SHALL `wrangler secret put` で上書きし、Workers の再デプロイなしに即座に反映される。
