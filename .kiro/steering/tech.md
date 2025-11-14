---
title: DOOM INDEX - 技術スタックと運用
includes: always
updated: 2025-01-27
---

## 全体アーキテクチャ

- フロントエンド: Next.js 16（App Router, Edge Runtime）
- 実行/配信: Cloudflare Pages + Workers（Cron Triggers, R2 Bindings）
- ストレージ: Cloudflare R2（S3 互換, 公開ドメイン読み取り）
- ランタイム: ローカル Bun / 本番 workerd
- 生成: Runware（既定）/ OpenAI（AI SDK）/ Mock
- 3D 表示: React Three Fiber + Three.js
- **API 通信: tRPC v11（エンドツーエンド型安全）**
- データ取得・状態: TanStack Query（クライアント）+ tRPC + サービス層（サーバ）
- エラー処理: neverthrow（Result 型）
- **キャッシュ: Cloudflare Cache API（開発中）** - Edge キャッシュによる最適化

## リポジトリ主要構成

- `src/app` App Router 構成（API/OGP含む, Edge 前提）
- `src/server/trpc` tRPC ルーター・スキーマ・コンテキスト（型安全 API）
- `src/services` ビジネスロジック（市場データ、生成、状態、収益等）
- `src/lib` 外部統合（R2, Provider, tRPC クライアント, 時刻, ハッシュ, 純関数群）
- `src/lib/cache` Cloudflare Cache API ヘルパー（開発中）
- `src/components` UI/3D/ユーティリティ
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

- ランタイム/フレームワーク: `next@16`, `react@19`, `typescript@^5.9`, `bun@1.3.2`
- 描画/3D: `three`, `@react-three/fiber`, `@react-three/drei`
- **API/型安全: `@trpc/server@^11.7`, `@trpc/client@^11.7`, `@trpc/react-query@^11.7`, `@trpc/next@^11.7`**
- 状態/バリデーション: `@tanstack/react-query@^5.90`, `zod@^4.1`, `neverthrow@^7.2`
- 生成/AI: `ai@^5.0`, `@ai-sdk/openai@^2.0`
- 開発/CF: `wrangler@^4.48`, `@cloudflare/workers-types@^4.202`, `@opennextjs/cloudflare@^1.12`
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

# 型/テスト/ビルド/デプロイ
bun run typecheck
bun test
bun run build
bun run deploy
bun run wrangler:deploy
```

## 設定と型

- TypeScript: `strict: true`, `noEmit: true`
- パスエイリアス: `@/* -> ./src/*`
- 追加 types: `src/types/worker-configuration.d.ts`, `bun-types`, `node`, `@testing-library/jest-dom`

## テスト

- ランナー: `bun test`
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
- **Cloudflare Cache API 統合（開発中）** - Edge キャッシュによる最適化
