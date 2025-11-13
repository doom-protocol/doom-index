---
title: DOOM INDEX - 技術スタックと運用
includes: always
updated: 2025-11-13
---

## 全体アーキテクチャ
- フロントエンド: Next.js 16（App Router, Edge Runtime）
- 実行/配信: Cloudflare Pages + Workers（Cron Triggers, R2 Bindings）
- ストレージ: Cloudflare R2（S3 互換, 公開ドメイン読み取り）
- ランタイム: ローカル Bun / 本番 workerd
- 生成: Runware（既定）/ OpenAI（AI SDK）/ Mock
- 3D 表示: React Three Fiber + Three.js
- データ取得・状態: TanStack Query（クライアント）+ サービス層（サーバ）
- エラー処理: neverthrow（Result 型）

## リポジトリ主要構成
- `src/app` App Router 構成（API/OGP含む, Edge 前提）
- `src/services` ビジネスロジック（市場データ、生成、状態、収益等）
- `src/lib` 外部統合（R2, Provider, 時刻, ハッシュ, 純関数群）
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
- ランタイム/フレームワーク: `next@16`, `react@19`, `typescript@^5.9`, `bun@1.3.1`
- 描画/3D: `three`, `@react-three/fiber`, `@react-three/drei`
- 状態/バリデーション: `@tanstack/react-query`, `zod`, `neverthrow`
- 生成/AI: `ai`, `@ai-sdk/openai`
- 開発/CF: `wrangler`, `@cloudflare/workers-types`, `@opennextjs/cloudflare`
- 品質: `eslint@9`, `eslint-config-next@16`, `prettier@3`

## 環境変数
アプリ（README より抜粋・整理）
- 画像プロバイダ選択: `IMAGE_PROVIDER`（smart/openai/runware/mock）
- ログレベル: `LOG_LEVEL`（任意: ERROR/WARN/INFO/DEBUG/LOG）
- R2 公開ドメイン: `R2_PUBLIC_DOMAIN`（Pages 用）
- Provider キー（選択に応じ設定）
  - `OPENAI_API_KEY`
  - `RUNWARE_API_KEY`
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
- 結果型での合流点管理（neverthrow）
- Provider 抽象化（`src/lib/providers/*`）
- 純関数分離（`src/lib/pure/*`）でテスト容易性担保
