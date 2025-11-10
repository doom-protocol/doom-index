# Requirements Document

## Project Description (Input)

dynamic-ogp

## Introduction

Dynamic OGP は、DOOM INDEX の生成画像を Twitter、Facebook、Discord などのソーシャルプラットフォームで効果的に共有するための動的 Open Graph Protocol 画像生成機能である。8 トークン（`$CO2` から `$HOPE`）の Market Cap から算出されたプロンプトで生成された「この世界を表す 1 枚の絵画」を常に OGP 画像として表示し、ソーシャルクローラが最新の生成アートワークを取得できるようにする。

技術的には、Next.js の `opengraph-image.tsx` ファイル規約と `next/og` の `ImageResponse` を活用し、R2 に保存された 1:1（1024×1024）の正方形画像を取得して OGP の標準アスペクト比（1200×630）に変換する。画像は中央配置し、上下または左右の余白を黒（`#000000`）で埋めることで、ソーシャルプラットフォームでの表示を最適化する。Route Handlers の動的レンダリング機能により、1 分間隔の Cron 生成サイクルで更新される最新画像を常に反映する。キャッシュ戦略は `cache-control: max-age=60, stale-while-revalidate=30` を基本とし、Cloudflare Pages の Edge Cache と連携させる。

## Requirements

### Requirement 1: Next.js opengraph-image と ImageResponse による OGP 画像合成

**Objective:** As a Social Media User, I want the latest generated artwork centered in OGP format with black letterboxing, so that my shared links display optimally on social platforms.

#### Acceptance Criteria

1. WHEN `app/opengraph-image.tsx` が実装されるとき THEN OGP Generator SHALL `next/og` の `ImageResponse` を使用し、JSX で OGP 画像（1200×630 px）を動的に生成する。
2. IF R2 公開 URL（`https://{R2_DOMAIN}/state/global.json`）から `state/global.json` が取得できたとき THEN OGP Generator SHALL `lastThumbnailUrl` を抽出し、R2 から画像を `fetch` で取得して base64 または `ArrayBuffer` として読み込む。
3. WHERE 正方形画像（1024×1024）を OGP サイズ（1200×630）に配置するとき THEN OGP Generator SHALL 画像を中央配置し、アスペクト比を維持したまま高さ 630px に合わせてスケーリング（幅約 630px）し、左右の余白（各約 285px）を黒（`#000000`）で埋める。
4. WHEN `ImageResponse` の JSX を構築するとき THEN OGP Generator SHALL `<div style={{ display: 'flex', width: '100%', height: '100%', background: '#000000', alignItems: 'center', justifyContent: 'center' }}>` をコンテナとし、内部に `<img src={imageDataUrl} style={{ height: '100%', width: 'auto', objectFit: 'contain' }} />` を配置する。
5. IF `state/global.json` が存在しないまたは取得に失敗したとき THEN OGP Generator SHALL `public/placeholder-painting.webp` をファイルシステムから `readFile` で読み込み、同様に黒背景の中央配置で `ImageResponse` を生成する。
6. WHEN 生成された画像を返すとき THEN OGP Generator SHALL `Content-Type: image/png`（ImageResponse のデフォルト）、`Cache-Control: public, max-age=60, stale-while-revalidate=30` ヘッダーを設定し、1 分間のキャッシュを許容する。

### Requirement 2: OGP メタデータの設定（generateMetadata）

**Objective:** As a Metadata Engineer, I want comprehensive OGP metadata in the root layout, so that each social platform renders the optimal preview card with the latest artwork.

#### Acceptance Criteria

1. WHEN `app/layout.tsx` の `generateMetadata` が実行されるとき THEN Metadata Layer SHALL R2 公開 URL から `state/global.json` を取得し、`lastTs`、`prevHash` を含むメタデータを構築する。
2. IF `state/global.json` が取得できたとき THEN Metadata Layer SHALL `title="DOOM INDEX - World State Visualization"`、`description="8 global indicators ($CO2, $ICE, $FOREST, $NUKE, $MACHINE, $PANDEMIC, $FEAR, $HOPE) visualized as generative art in real-time."`、`openGraph.images=[{ url: '/opengraph-image', width: 1200, height: 630 }]` を設定する。
3. WHERE Twitter カード用メタを生成するとき THEN Metadata Layer SHALL `twitter.card="summary_large_image"`、`twitter.site="@doomindex"`、`twitter.title`、`twitter.description`、`twitter.images` を OG タグと同一内容で設定する。
4. WHEN OGP 画像 URL を指定するとき THEN Metadata Layer SHALL Next.js の `opengraph-image` ファイル規約により自動生成される `/opengraph-image` パスを使用し、絶対 URL への変換は Next.js に委ねる。
5. IF `state/global.json` が存在しないとき THEN Metadata Layer SHALL デフォルトメタデータ（`description="Awaiting first generation..."`）を設定し、プレースホルダ画像を OGP 画像として使用する。

### Requirement 3: 動的画像のキャッシュ戦略と再検証

**Objective:** As a Performance Engineer, I want efficient caching aligned with the 1-minute generation cycle, so that social crawlers see fresh content without overloading R2.

#### Acceptance Criteria

1. WHEN `opengraph-image.tsx` が画像を返すとき THEN Cache Layer SHALL HTTP レスポンスヘッダーに `Cache-Control: public, max-age=60, stale-while-revalidate=30` を設定する。
2. IF R2 から state を取得する際に THEN Cache Layer SHALL `fetch(url, { cache: "no-store" })` を使用し、常に最新の state を R2 から取得する（Next.js の静的キャッシュを回避）。
3. WHERE Cloudflare Pages の Edge Cache が有効なとき THEN Cache Layer SHALL 60 秒間のエッジキャッシュを活用し、同一画像への重複リクエストを削減する。
4. WHEN Cron Worker が新しい画像を生成し `lastThumbnailUrl` を更新したとき THEN OGP Generator SHALL 次回のリクエスト時（キャッシュ期限切れ後）に新しい画像を自動的に取得して配信する。
5. IF R2 からの画像取得が失敗したとき THEN Cache Layer SHALL プレースホルダ画像を `Cache-Control: public, max-age=300` で返し、5 分間キャッシュして R2 への負荷を軽減する。

### Requirement 4: Route Segment Config による ISR 設定

**Objective:** As a System Architect, I want proper route configuration with ISR, so that OGP images update every 60 seconds while minimizing generation costs.

#### Acceptance Criteria

1. WHEN `opengraph-image.tsx` にエクスポート設定を追加するとき THEN Route Config SHALL `export const revalidate = 60` を設定し、ISR で 60 秒ごとに再生成する。
2. IF `opengraph-image.tsx` で画像サイズを指定するとき THEN Route Config SHALL `export const size = { width: 1200, height: 630 }` と `export const contentType = 'image/png'` を設定する（ImageResponse のデフォルト形式）。
3. WHERE `opengraph-image.tsx` で alt テキストを指定するとき THEN Route Config SHALL `export const alt = 'DOOM INDEX - Current world state visualization'` を設定する。
4. WHEN ISR により再生成がトリガーされるとき THEN Next.js SHALL バックグラウンドで新しい画像を生成し、完了後に自動的にキャッシュを更新する。

### Requirement 5: エラーハンドリングとフォールバック

**Objective:** As a Reliability Engineer, I want graceful error handling and fallback images, so that OGP always displays content even if R2 is temporarily unavailable.

#### Acceptance Criteria

1. IF R2 からの `state/global.json` 取得が HTTP 5xx または timeout で失敗したとき THEN Error Handler SHALL エラーをログに記録し、プレースホルダ画像を返す。
2. WHEN プレースホルダ画像を返すとき THEN Fallback Layer SHALL `public/placeholder-painting.webp` をファイルシステムから `readFile` で読み込み、`Response` オブジェクトとして返す。
3. WHERE `opengraph-image.tsx` で例外が発生したとき THEN Error Boundary SHALL `console.error` でログ出力し、Next.js のデフォルトエラーハンドリングに委ねる（500 エラーを返す）。
4. IF `lastThumbnailUrl` が R2 に存在しないとき THEN OGP Generator SHALL 404 をプレースホルダへのフォールバックとして扱い、正常な画像レスポンスを返す。
5. WHEN `generateMetadata` で R2 取得が失敗したとき THEN Metadata Layer SHALL デフォルトメタデータ（`title="DOOM INDEX"`, `description="World state visualization through generative art."`）を返す。

### Requirement 6: ソーシャルプラットフォーム検証とプレビュー

**Objective:** As a QA Engineer, I want to validate OGP rendering on major social platforms, so that all share links display correctly before production deployment.

#### Acceptance Criteria

1. WHEN 開発・ステージング環境でデプロイしたとき THEN QA Process SHALL [Twitter Card Validator](https://cards-dev.twitter.com/validator) で OGP カードをプレビューし、画像・タイトル・説明文が正しく表示されることを確認する。
2. IF [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) で URL をテストするとき THEN QA Process SHALL `og:image` が 1200×630 の横長アスペクト比で正しく読み込まれ、正方形の生成画像が黒背景の中央に配置されていることを確認する。
3. WHERE Discord の埋め込みプレビューをテストするとき THEN QA Process SHALL Discord チャンネルにメインページ URL を投稿し、`twitter:card` と `og:image` が正しくレンダリングされ、レターボックス形式で表示されることを確認する。
4. WHEN LinkedIn でのシェアをテストするとき THEN QA Process SHALL LinkedIn の Post Inspector で `og:title`, `og:description`, `og:image` の表示を検証し、1200×630 サイズが適切に処理されることを確認する。
5. IF いずれかのプラットフォームでレンダリングが失敗したとき THEN QA Process SHALL 原因を特定し（例: 画像サイズ不足、HTTPS 未対応、キャッシュヘッダー問題、アスペクト比の問題）、修正後に再検証する。

### Requirement 7: 生成画像と state の整合性保証

**Objective:** As a State Manager, I want guaranteed consistency between generated images and global state, so that OGP never displays outdated artwork.

#### Acceptance Criteria

1. WHEN Cron Worker が新しい画像を生成し R2 に保存したとき THEN State Service SHALL `state/global.json` の `lastThumbnailUrl` を最新画像 URL に更新し、`lastTs` と `prevHash` も同時に更新する（アトミック操作）。
2. IF 画像保存は成功したが state 更新が失敗したとき THEN Error Handler SHALL state 更新をリトライし、リトライ上限（3 回）を超えた場合は Cloudflare Logs にエラーを記録して次の Cron サイクルで再試行する。
3. WHERE `opengraph-image.tsx` が `lastThumbnailUrl` を取得するとき THEN OGP Generator SHALL `state/global.json` の読み取りのみを行い、書き込みは一切実行しない（読み取り専用）。
4. WHEN グローバル state の整合性が検証されるとき THEN Validation Service SHALL `lastThumbnailUrl` が R2 に実際に存在することを確認し、存在しない場合は次回の Cron 実行時に再生成をトリガーする。

### Requirement 8: 監視とログ出力の整備

**Objective:** As an Operations Engineer, I want detailed logs and monitoring metrics for OGP image delivery, so that I can detect and resolve issues proactively.

#### Acceptance Criteria

1. WHEN `opengraph-image.tsx` が画像を返すとき THEN Logging Layer SHALL `{ route: "/opengraph-image", stateFound: boolean, imageProxied: boolean, fallbackUsed: boolean, responseTimeMs, timestamp }` を構造化ログとして出力する。
2. IF R2 からの state または画像取得が失敗したとき THEN Logging Layer SHALL `logger.error("ogp.fetch-failed", { url, status, message })` を記録する。
3. WHERE ソーシャルクローラのアクセスを検出したとき THEN Analytics Layer SHALL User-Agent ヘッダーから `Twitterbot`, `facebookexternalhit`, `Discordbot`, `LinkedInBot` などを識別し、`{ event: "social-crawler", platform, timestamp }` をログに記録する。
4. WHEN `/opengraph-image` のレスポンス時間が 2000ms を超えたとき THEN Monitoring Layer SHALL アラートを発火し、R2 レイテンシまたはネットワーク問題を通知する。
5. IF OGP 画像の生成またはプロキシでエラーが発生したとき THEN Error Handler SHALL `logger.error("ogp.error", { error, stack, fallbackUsed })` を記録し、Cloudflare Workers Analytics に送信する。
