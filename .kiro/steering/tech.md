---
title: DOOM INDEX - 技術スタックと運用
includes: always
updated: 2025-11-22
---

## 全体アーキテクチャ

- フロントエンド: Next.js 16（App Router, Edge Runtime）
- 実行/配信: Cloudflare Pages + Workers（Cron Triggers, R2 Bindings）
- ストレージ: Cloudflare R2（S3 互換, 公開ドメイン読み取り）
- **データベース: Cloudflare D1（SQLite 互換）** - アーカイブインデックスとトークンコンテキストキャッシュ
- ランタイム: ローカル Bun / 本番 workerd
- 生成: Runware（既定）/ OpenAI（AI SDK）/ Mock
- **AI 生成: Cloudflare Workers AI** - テキスト生成と JSON 構造化出力
- **外部検索: Tavily Search API** - トークン情報の Web 検索と要約
- 3D 表示: React Three Fiber + Three.js
- **API 通信: tRPC v11（エンドツーエンド型安全）**
- データ取得・状態: TanStack Query（クライアント）+ tRPC + サービス層（サーバ）
- エラー処理: neverthrow（Result 型）
- **キャッシュ: Cloudflare Cache API（開発中）** - Edge キャッシュによる最適化

## リポジトリ主要構成

- `src/app` App Router 構成（API/OGP/アーカイブ含む, Edge 前提）
- `src/server/trpc` tRPC ルーター・スキーマ・コンテキスト（型安全 API）
- `src/services` ビジネスロジック（市場データ、生成、状態、収益等）
  - `src/services/paintings/` 絵画生成オーケストレーターと関連サービス
  - `src/services/token-analysis-service.ts` トークン分析サービス
- `src/lib` 外部統合（R2, Provider, tRPC クライアント, 時刻, ハッシュ, 純関数群）
- `src/lib/cache` Cloudflare Cache API ヘルパー（開発中）
- `src/repositories` データアクセス層（D1）
  - `paintings-repository.ts`
  - `tokens-repository.ts`
  - `market-snapshots-repository.ts`
- `src/db` データベーススキーマ（Drizzle ORM）
  - `src/db/schema/archive.ts` アーカイブインデックステーブル
  - `src/db/schema/token-contexts.ts` トークンコンテキストキャッシュテーブル
- `src/components` UI/3D/ユーティリティ
  - `src/components/archive` アーカイブページコンポーネント
- `src/constants` プロンプト・トークン定数
- `src/workers` Worker エントリ・処理
- `tests/` unit/integration テスト

## フロントエンド

- Next.js 16, React 19, TypeScript 5.9
- Three.js 0.181, @react-three/fiber / drei
- UI 補助: TanStack Query, Tailwind CSS 4（PostCSS 経由）
- 画像/OGP: `src/app/opengraph-image.tsx`

## バックエンド/エッジ

- Cloudflare Workers（Cron: 毎分トリガ）
- R2 連携（Bindings or 公開ドメイン）
- OpenNext for Cloudflare によるビルド/デプロイ（`@opennextjs/cloudflare`）

## 依存関係（主要）

- ランタイム/フレームワーク: `next@16.0.1`, `react@19.2.0`, `typescript@^5.9.3`, `bun@1.3.3`
- 描画/3D: `three`, `@react-three/fiber`, `@react-three/drei`
- **API/型安全: `@trpc/server@^11.7`, `@trpc/client@^11.7`, `@trpc/react-query@^11.7`, `@trpc/next@^11.7`**
- **データベース: `drizzle-orm@^0.44`** - D1（SQLite）用 ORM
- 状態/バリデーション: `@tanstack/react-query@^5.90`, `zod@^3.23`, `neverthrow@^7.2`
- 生成/AI: `ai@^5.0`, `@ai-sdk/openai@^2.0`
- **環境変数管理: `@t3-oss/env-nextjs@^0.13`** - 型安全な環境変数検証
- 開発/CF: `wrangler@4.48.0`, `@cloudflare/workers-types@^4.202`, `@opennextjs/cloudflare@1.12.0`
- 品質: `eslint@9`, `eslint-config-next@16`, `prettier@3`

## 環境変数

アプリ（README より抜粋・整理）

- **画像生成モデル: `IMAGE_MODEL`**（任意: "runware:100@1", "civitai:38784@44716", "dall-e-3" 等）
- 画像プロバイダ選択: `IMAGE_PROVIDER`（smart/openai/runware/mock）
- **ログレベル: `LOG_LEVEL`**（任意: ERROR/WARN/INFO/DEBUG/LOG、クライアント公開可）
- **Node 環境: `NODE_ENV`**（development/test/production、クライアント公開可）
- **ベース URL: `NEXT_PUBLIC_BASE_URL`**（必須、クライアント公開）
- R2 公開ドメイン: `R2_PUBLIC_DOMAIN`（Pages 用）
- Provider キー（選択に応じ設定）
  - `OPENAI_API_KEY`（任意）
  - `RUNWARE_API_KEY`（必須）
  - Workers 用: `PROVIDER_API_KEY`（Secrets）
- **Workers AI モデル: `WORKERS_AI_DEFAULT_MODEL`**（任意、デフォルト: `@cf/ibm-granite/granite-4.0-h-micro`）
- **Tavily API キー: `TAVILY_API_KEY`**（dynamic-prompt 用、必須）
- D1 データベース設定（Cloudflare Dashboard で設定）
  - `CLOUDFLARE_ACCOUNT_ID`（本番マイグレーション用）
  - `CLOUDFLARE_DATABASE_ID`（本番マイグレーション用）
  - `CLOUDFLARE_D1_TOKEN`（本番マイグレーション用）
- 任意（高速バッチアップロード: OpenNext Build/Deploy）
  - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CF_ACCOUNT_ID`

## ポート/実行

- Next.js 開発: 既定 3000
- Workers プレビュー: 既定 8787（README 記載）

## よく使うコマンド（package.json）

```bash
# 開発（Next.js）
bun run dev

# Cloudflare プレビュー（Cron テスト有）
bun run preview

# Cron ローカル監視
bun run watch-cron

# データベース操作
bun run db:generate    # Drizzle マイグレーション生成
bun run db:migrate     # ローカル D1 マイグレーション実行
bun run db:migrate:prod # 本番 D1 マイグレーション実行
bun run db:push        # Drizzle スキーマを直接プッシュ（開発用）
bun run db:studio      # Drizzle Studio で DB を可視化

# 型/テスト/ビルド/デプロイ
bun run typecheck
bun run test
bun run build
bun run deploy
bun run wrangler:deploy
```

## 設定と型

- TypeScript: `strict: true`, `noEmit: true`
- パスエイリアス: `@/* -> ./src/*`
- 追加 types: `src/types/worker-configuration.d.ts`, `bun-types`, `node`, `@testing-library/jest-dom`

## テスト

- ランナー: `bun run test`
- DOM/React: `@testing-library/*`, `@happy-dom/global-registrator`
- フィルタ: `test:unit`, `test:integration`
- 事前ロード: `tests/preload.ts`

## ビルド/デプロイ

- OpenNext for Cloudflare（`opennextjs-cloudflare`）
  - `build`, `preview`, `upload`, `deploy`
- Workers: `wrangler`（型生成/デプロイ）
- Pages: `deploy`（OpenNext 出力）

## 実装ポリシー（抜粋）

- Edge ファースト（API/OGPはできる限り Edge）
- **tRPC による型安全 API** - エンドツーエンドの型推論とバリデーション
- 結果型での合流点管理（neverthrow）
- Provider 抽象化（`src/lib/providers/*`）
- 純関数分離（`src/lib/pure/*`）でテスト容易性担保
- **D1 データベース統合** - Drizzle ORM による型安全なスキーマ定義とクエリ
- **動的プロンプト生成** - Tavily + Workers AI によるトークンコンテキストの自動生成とキャッシュ
- **Cloudflare Cache API 統合（開発中）** - Edge キャッシュによる最適化
