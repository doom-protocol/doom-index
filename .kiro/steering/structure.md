---
title: DOOM INDEX - プロジェクト構造と規約
includes: always
updated: 2025-11-22
---

## ルート構成（概要）

- `src/` アプリケーション本体
- `scripts/` 生成・補助 CLI
- `tests/` unit/integration テスト
- `public/` 静的アセット（OGP 既定画像等）
- `docs/` 仕様・背景ドキュメント（tRPC アーキテクチャ、移行ガイド含む）
- `.kiro/` Kiro（ステアリング/スペック）
- 構成ファイル: `package.json`, `tsconfig.json`, `wrangler.toml`, `open-next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`

## `src/` 詳細

- `app/` Next.js App Router
  - `api/trpc/[trpc]/route.ts` **tRPC HTTP エンドポイント（Edge Runtime）**
  - `api/r2/[...key]/route.ts` R2 オブジェクト取得（レガシー、tRPC 移行済み）
  - `opengraph-image.tsx` 動的 OGP 画像
  - `layout.tsx`, `page.tsx`, `globals.css`, `providers.tsx`
  - `about/` About ページ（ホワイトペーパー表示）
  - `archive/` **アーカイブページ** - 過去の生成作品を閲覧・検索
- `server/trpc/` **tRPC サーバー実装**
  - `context.ts` コンテキスト作成（Cloudflare Bindings 注入）
  - `trpc.ts` tRPC 初期化とミドルウェア
  - `schemas/index.ts` zod スキーマ定義
  - `routers/` ドメイン別ルーター
    - `_app.ts` メインルーター（全サブルーター統合）
    - `mc.ts` マーケットキャップルーター
    - `viewer.ts` Viewer 登録・削除ルーター
    - `token.ts` トークン状態取得ルーター
    - `r2.ts` R2 オブジェクト取得ルーター
- `components/`
  - `gallery/` 3D シーン（camera-rig, framed-painting, lights, scene）
  - `ui/` UI コンポーネント（トップバー、リアルタイム表示 等）
  - `about/` About ページコンポーネント（whitepaper-viewer, about-scene 等）
  - `archive/` **アーカイブページコンポーネント**（archive-content, archive-grid, archive-item 等）
  - `icons/` アイコン群
- `constants/` 固定値・プロンプト・トークン定義
- `hooks/` React hooks（グローバル状態、MC、画像、viewer、tRPC 統合）
- `lib/` **外部統合・腐敗防止層・独自モジュール**
  - 外部 API の wrapper、lib の腐敗防止層、独自モジュールなどを基本的に配置
  - `trpc/` **tRPC クライアント実装**
    - `client.ts` クライアントサイド tRPC クライアント（TanStack Query 統合）
    - `server.ts` サーバーサイド tRPC クライアント（Server Components 用）
    - `vanilla-client.ts` vanilla tRPC クライアント（Web Workers 用）
  - `providers/` 画像生成 Provider 実装（ai-sdk, runware, mock, index）
  - `cache.ts` **Cloudflare Cache API ヘルパー（開発中）**
  - `r2.ts` R2 クライアント（環境差吸収）
  - `pure/` **純関数・ドメインロジック計算**
    - domain logic に直結する数値計算や、小さく切り出して testability を高める必要がある複雑な検証・計算ロジックを配置
    - プロンプト合成/正規化/量子化/ハッシュ等の純粋関数
  - 共通: `hash.ts`, `round.ts`, `time.ts`, `runware-client.ts`, `kv.ts`
- `services/` ビジネスロジック
  - `image-generation.ts` 画像生成サービス
  - `token-analysis-service.ts` トークン分析サービス
  - `world-prompt-service.ts` ワールドプロンプトサービス
  - `viewer.ts` 閲覧者関連
  - `paintings/` 絵画生成関連サービス
    - `painting-generation-orchestrator.ts` メインオーケストレーター
    - `token-selection.ts` トークン選択ロジック
    - `painting-context-builder.ts` 絵画コンテキスト構築
    - `scoring-engine.ts` スコアリングエンジン
    - `token-data-fetch.ts` トークンデータ取得
    - `market-data.ts` 市場データ取得
    - `storage.ts` ストレージ操作
    - `list.ts` リスト操作
- `repositories/` **データアクセス層（D1）**
  - `paintings-repository.ts`
  - `tokens-repository.ts`
  - `market-snapshots-repository.ts`
- `db/` **データベーススキーマ（Drizzle ORM）**
  - `index.ts` スキーマエクスポートと DB 接続ファクトリ
  - `schema/archive.ts` アーカイブインデックステーブル定義
  - `schema/token-contexts.ts` トークンコンテキストキャッシュテーブル定義
- `types/` 型定義（ドメイン、OpenNext、エラー、ワーカー設定 等）
- `utils/` 画像/URL/UA/ロガー/エラー ユーティリティ
- `workers/` **Web Worker / Service Worker 実装**
  - Web Worker や Service Worker などを TypeScript で実装したものを格納（例: viewer.worker.ts）
- `worker.ts` エントリ
- `cron.ts` Cloudflare Workers Cron Handler

## 命名規約・配置

- ファイル/ディレクトリ: 原則ケバブケース（TypeScript 型はパスカルケース）
- React コンポーネント: `*.tsx`、フォルダ co-location（スタイル/補助は近傍に配置）
- **tRPC ルーター: `src/server/trpc/routers/[domain].ts`**（例: `mc.ts`, `viewer.ts`）
- **tRPC スキーマ: `src/server/trpc/schemas/index.ts`**（共通スキーマを集約）
- **tRPC クライアント: `src/lib/trpc/[type]-client.ts`**（React/Server/Vanilla）
- **データベーススキーマ: `src/db/schema/[table].ts`**（Drizzle ORM テーブル定義）
- **データベース接続: `src/db/index.ts`**（D1 バインディングから Drizzle インスタンス生成）
- **純関数・ドメインロジック計算: `src/lib/pure/*`** - domain logic に直結する数値計算や、小さく切り出して testability を高める必要がある複雑な検証・計算ロジックを配置（副作用のない計算を明示）
- **外部統合・腐敗防止層: `src/lib/*`** - 外部 API の wrapper、lib の腐敗防止層、独自モジュールなどを基本的に配置
- Provider 実装: `src/lib/providers/*` に実装し、`index.ts` で解決
- サービス層: `src/services/*` にユースケース別に分割（サブディレクトリも可）
- API ルート: `src/app/api/trpc/[trpc]/route.ts`（tRPC HTTP エンドポイント、Edge 前提）

## インポート規約

- パスエイリアス: `@/*`（`tsconfig.json` `paths`）
- 外部 -> 内部の順（外部ライブラリ → `@/*`）
- 循環参照を避ける（サービス→UIの逆流を禁止）

## アーキテクチャ原則

- Edge ファースト・I/O分離（副作用は境界で実行）
- **tRPC による型安全 API** - エンドツーエンドの型推論、zod バリデーション、エラーハンドリング
- 結果型（neverthrow）で明示的に失敗を伝播（tRPC プロシージャ内で Result 型を tRPCError に変換）
- **D1 データベース統合** - Drizzle ORM による型安全なスキーマ定義、マイグレーション管理、クエリ構築
- 純関数と状態/副作用の分離でテスト容易性を担保
- Provider 抽象化でモデル・実行環境差を吸収
- R2 は Workers では Binding、Next.js では公開 URL を使用
- **D1 は Workers では Binding、Next.js では HTTP API 経由**（`drizzle-kit` の `d1-http` ドライバ使用）
- **動的プロンプト生成** - Tavily 検索結果を Workers AI で要約し、D1 にキャッシュして再利用
- **Cloudflare Cache API 統合（開発中）** - Edge キャッシュによる外部 API 呼び出し削減とレイテンシ低減

## 追加の作法

- 新機能: `.kiro/specs/<feature>/` に要件→設計→タスクを定義し、実装へ
- **tRPC プロシージャ追加時**: `src/server/trpc/routers/[domain].ts` に追加、スキーマは `schemas/index.ts` に定義
- **tRPC クライアント使用**: React コンポーネントでは `lib/trpc/client.ts` 経由、Server Components では `lib/trpc/server.ts` 経由
- **データベーススキーマ追加時**: `src/db/schema/[table].ts` に Drizzle テーブル定義を追加、`src/db/index.ts` のスキーマエクスポートに含める
- **データベースマイグレーション**: `bun run db:generate` でマイグレーション生成、`bun run db:migrate` でローカル実行、`bun run db:migrate:prod` で本番実行
- **動的プロンプト生成**: `src/services/dynamic-prompt/` のサービスを使用し、D1 キャッシュを優先的に参照
- コンポーネント: 近接配置（styles/hooks/utils を隣接）
- テスト: `tests/unit/..`, `tests/integration/..` に対応配置（tRPC ルーター/コンテキストの統合テスト含む）
- OGP/公開物: 既定は `public/`、動的は `app/opengraph-image.tsx`

## 変更の指針

- 既存のディレクトリ構造に合わせる（不要な階層を増やさない）
- セマンティック分割（似た概念は抽象化/統合）
- 命名は目的を表す完全語を優先（省略語は避ける）
