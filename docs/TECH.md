---
title: DOOM INDEX - 技術スタックと運用
includes: always
updated: 2026-03-13
---

## 全体アーキテクチャ

- フロントエンド: Next.js 16（App Router, Edge Runtime, React Compiler）
- バンドラー: **Vite + vinext** - Next.js App Router を Vite ベースでビルド
- 実行/配信: Cloudflare Workers（Web + Cron）
- ストレージ: Arweave（Turbo SDK 経由アップロード、gateway 読み取り。定期生成は image-only、GLB は mint 時に upload）
- **データベース: Cloudflare D1（SQLite 互換）** - アーカイブインデックスとトークンコンテキストキャッシュ
- ランタイム: ローカル Bun / 本番 workerd
- 画像生成: Runware（本番）/ Mock（テスト用）
- **AI 生成: Cloudflare Workers AI** - テキスト生成と JSON 構造化出力
- **外部検索: Tavily Search API** - トークン情報の Web 検索と要約
- 3D 表示: React Three Fiber + Three.js
- **API 通信: tRPC v11（エンドツーエンド型安全）**
- データ取得・状態: TanStack Query（クライアント）+ tRPC + サービス層（サーバ）
- エラー処理: neverthrow（Result 型）
- **バリデーション: valibot** - 型安全な環境変数とスキーマ検証
- **キャッシュ: Cloudflare Cache API** - Edge キャッシュによる最適化
- **NFT ミント: Doom NFT program + Arweave ストレージ** - カスタム Solana ミントプログラムと Arweave メタデータ配信。初回 mint で GLB を生成・保存し、以後は painting ごとに再利用

## リポジトリ主要構成

- `src/app` App Router 構成（API/OGP/アーカイブ含む, Edge 前提）
- `src/server/trpc` tRPC ルーター・スキーマ・コンテキスト（型安全 API）
- `src/server/services` サーバー専用ビジネスロジック（市場データ、生成、状態、収益等）
  - `src/server/services/paintings/` 絵画生成オーケストレーターと関連サービス
  - `src/server/services/token-analysis-service.ts` トークン分析サービス
- `src/lib` 外部統合（ArDrive, Provider, tRPC クライアント, 時刻, ハッシュ, 純関数群）
- `src/lib/cache` Cloudflare Cache API ヘルパー（開発中）
- `src/server/repositories` データアクセス層（D1）
  - `paintings-repository.ts`
  - `tokens-repository.ts`
  - `market-snapshots-repository.ts`
- `src/server/db` データベーススキーマ（Drizzle ORM）
  - `src/server/db/schema/*.ts` D1 テーブル定義
- `src/components` UI/3D/ユーティリティ
  - `src/components/archive` アーカイブページコンポーネント
- `src/constants` プロンプト・トークン定数
- `src/types` クライアント共有型（API 応答 DTO、ドメイン型、エラー、ワーカー設定 等）
- `src/workers` Worker エントリ・処理
- `tests/` unit/integration テスト

## フロントエンド

- Next.js 16, React 19, TypeScript 5.9
- Three.js 0.181, @react-three/fiber / drei
- UI 補助: TanStack Query, Tailwind CSS 4（PostCSS 経由）
- 画像/OGP: `src/app/opengraph-image.tsx`

## バックエンド/エッジ

- Cloudflare Workers（Cron: 10分ごとトリガ - `*/10 * * * *`）
- Turbo SDK / Arweave gateway 連携
- recurring generation では image upload のみを行い、mint preparation で GLB + metadata + manifest を補完
- `vinext build` + Cloudflare Vite plugin による Workers 向けビルド

## 依存関係（主要）

- ランタイム/フレームワーク: `next@16.1.6`, `react@19.2.0`, `typescript@^5.9.3`, `bun@1.3.10`
- **型チェック: `@typescript/native-preview` (tsgo)** - TypeScript Native Preview による高速型チェック
- **バンドラー: `vinext@^0.0.30`, `vite@^8.0.0`** - Vite ベースの Next.js App Router ビルド
- 描画/3D: `three@^0.181.2`, `@react-three/fiber@^9.4.2`, `@react-three/drei@^10.7.7`
- **API/型安全: `@trpc/server@^11.7.2`, `@trpc/client@^11.7.2`, `@trpc/react-query@^11.7.2`, `@trpc/tanstack-react-query@^11.7.2`**
- **データベース: `drizzle-orm@^0.44.7`** - D1（SQLite）用 ORM
- **マイグレーション: `drizzle-kit@^0.31.7`** - Drizzle マイグレーション管理
- 状態/バリデーション: `@tanstack/react-query@^5.90.11`, `valibot@^1.2.0`, `neverthrow@^7.2.0`
- **NFT/ブロックチェーン: `@metaplex-foundation/*`, `@solana/web3.js@^1.98.4`, `@solana/wallet-adapter-*`**
- **Arweave: `@ardrive/turbo-sdk`** - Turbo SDK for Arweave uploads
- **環境変数管理: `@t3-oss/env-nextjs@^0.13.8`** - valibot ベースの型安全な環境変数検証
- 開発/CF: `wrangler@^4.73.0`, `@cloudflare/workers-types@^4.20260313.1`, `@cloudflare/vite-plugin@^1.28.0`
- 品質: `eslint@^9.39.1`, `eslint-config-next@16.1.6`, `oxfmt`

## 環境変数

アプリ（README より抜粋・整理）

- **画像生成モデル: `IMAGE_MODEL`**（任意: "runware:100@1", "runware:400@1" 等）
- **ログレベル: `LOG_LEVEL`**（任意: ERROR/WARN/INFO/DEBUG/LOG、クライアント公開可）
- **Node 環境: `NODE_ENV`**（development/test/production、クライアント公開可）
- **ベース URL: `NEXT_PUBLIC_BASE_URL`**（必須、クライアント公開）
- Provider キー
  - `RUNWARE_API_KEY`（必須）
- **Tavily API キー: `TAVILY_API_KEY`**（dynamic-prompt 用、任意）
- **CoinGecko API キー: `COINGECKO_API_KEY`**（任意、レート制限緩和用）
- **Solana RPC: `NEXT_PUBLIC_SOLANA_RPC_URL`**（任意、デフォルト: devnet）
- **Arweave: `ARDRIVE_TURBO_SECRET_KEY`**（ArDrive JWK secret, NFT metadata upload 用）
- **Arweave Gateway: `ARWEAVE_GATEWAY_BASE_URL`**（任意、既定: `https://permagate.io`）
- D1 データベース設定（Cloudflare Dashboard で設定）
  - `CLOUDFLARE_ACCOUNT_ID`（本番マイグレーション用）
  - `CLOUDFLARE_DATABASE_ID`（本番マイグレーション用）
  - `CLOUDFLARE_D1_TOKEN`（本番マイグレーション用）
- 任意（Cloudflare deploy / migration 用）
  - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CF_ACCOUNT_ID`

## ポート/実行

- vinext 開発: 既定 8787（`bun run dev`）
- 生成間隔: 10分ごと（`NEXT_PUBLIC_GENERATION_INTERVAL_MS=600000`）

## よく使うコマンド（package.json）

```bash
# 開発（Next.js）
bun run dev

# Cloudflare Web Worker dry-run
bun run build:cf

# Cron ローカル監視
bun run watch-cron

# データベース操作
bun run db:generate    # Drizzle マイグレーション生成
bun run db:migrate     # ローカル D1 マイグレーション実行
bun run db:migrate:prod # 本番 D1 マイグレーション実行
bun run db:push        # Drizzle スキーマを直接プッシュ（開発用）
bun run db:studio      # Drizzle Studio で DB を可視化

# 型/テスト/ビルド/デプロイ
bun run typecheck      # tsgo による高速型チェック
bun run test           # 全テスト実行
bun run test:unit      # ユニットテストのみ
bun run test:integration # インテグレーションテストのみ
bun run build          # vinext ビルド
bun run build:cf       # Cloudflare Worker package の dry-run 検証
bun run deploy         # Cloudflare へデプロイ
```

## 設定と型

- TypeScript: `strict: true`, `noEmit: true`
- パスエイリアス: `@/* -> ./src/*`
- サーバー実装 import: `@/server/*`
- 追加 types: `src/types/worker-configuration.d.ts`, `bun-types`, `node`, `@testing-library/jest-dom`

## テスト

- ランナー: `bun run test`
- DOM/React: `@testing-library/*`, `@happy-dom/global-registrator`
- フィルタ: `test:unit`, `test:integration`
- 事前ロード: `tests/preload.ts`

## ビルド/デプロイ

- Web: `vinext build` が `dist/server/wrangler.json` を生成し、`wrangler deploy` はその出力を使う
- Workers: `wrangler`（型生成/デプロイ、Cron worker 含む）
- 設定ソース: `wrangler.jsonc`, `vite.config.ts`

## 実装ポリシー（抜粋）

- Edge ファースト（API/OGPはできる限り Edge）
- **tRPC による型安全 API** - エンドツーエンドの型推論とバリデーション
- 結果型での合流点管理（neverthrow）
- Provider 抽象化（`src/lib/image-generation-providers/*`）- Runware を本番プロバイダとして使用
- 純関数分離（`src/lib/pure/*`）でテスト容易性担保
- **D1 データベース統合** - Drizzle ORM による型安全なスキーマ定義とクエリ
- **動的プロンプト生成** - Tavily + Workers AI によるトークンコンテキストの自動生成とキャッシュ
- **環境変数検証: valibot** - `@t3-oss/env-nextjs` による型安全な環境変数管理
- **Cloudflare Cache API 統合** - Edge キャッシュによる最適化
- **Solana NFT ミント** - Doom NFT program + Arweave パスマニフェストによる分散型所有権証明
