---
title: DOOM INDEX - 技術スタックと運用
includes: always
updated: 2025-12-02
---

## 全体アーキテクチャ

- フロントエンド: Next.js 16（App Router, Edge Runtime, React Compiler）
- バンドラー: **next-rspack** - Rust ベース高速バンドラー
- 実行/配信: Cloudflare Pages + Workers（Cron Triggers: 10分ごと, R2 Bindings）
- ストレージ: Cloudflare R2（S3 互換, 公開ドメイン読み取り）
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
- **NFT ミント: Metaplex + Irys** - Solana NFT 発行と IPFS ストレージ

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

- Cloudflare Workers（Cron: 10分ごとトリガ - `*/10 * * * *`）
- R2 連携（Bindings or 公開ドメイン）
- OpenNext for Cloudflare によるビルド/デプロイ（`@opennextjs/cloudflare@^1.14.0`）

## 依存関係（主要）

- ランタイム/フレームワーク: `next@16.0.1`, `react@19.2.0`, `typescript@^5.9.3`, `bun@1.3.3`
- **型チェック: `@typescript/native-preview` (tsgo)** - TypeScript Native Preview による高速型チェック
- **バンドラー: `next-rspack@^16.0.6`** - Rust ベース高速バンドラー
- 描画/3D: `three@^0.181.2`, `@react-three/fiber@^9.4.2`, `@react-three/drei@^10.7.7`
- **API/型安全: `@trpc/server@^11.7.2`, `@trpc/client@^11.7.2`, `@trpc/react-query@^11.7.2`, `@trpc/tanstack-react-query@^11.7.2`**
- **データベース: `drizzle-orm@^0.44.7`** - D1（SQLite）用 ORM
- **マイグレーション: `drizzle-kit@^0.31.7`** - Drizzle マイグレーション管理
- 状態/バリデーション: `@tanstack/react-query@^5.90.11`, `valibot@^1.2.0`, `neverthrow@^7.2.0`
- **NFT/ブロックチェーン: `@metaplex-foundation/*`, `@solana/web3.js@^1.98.4`, `@solana/wallet-adapter-*`**
- **IPFS: `pinata@^2.5.1`** - Pinata SDK for IPFS uploads
- **環境変数管理: `@t3-oss/env-nextjs@^0.13.8`** - valibot ベースの型安全な環境変数検証
- 開発/CF: `wrangler@^4.51.0`, `@cloudflare/workers-types@^4.20251202.0`, `@opennextjs/cloudflare@^1.14.0`
- 品質: `eslint@^9.39.1`, `eslint-config-next@16.0.1`, `prettier@^3.7.3`

## 環境変数

アプリ（README より抜粋・整理）

- **画像生成モデル: `IMAGE_MODEL`**（任意: "runware:100@1", "runware:400@1" 等）
- **ログレベル: `LOG_LEVEL`**（任意: ERROR/WARN/INFO/DEBUG/LOG、クライアント公開可）
- **Node 環境: `NODE_ENV`**（development/test/production、クライアント公開可）
- **ベース URL: `NEXT_PUBLIC_BASE_URL`**（必須、クライアント公開）
- **R2 URL: `NEXT_PUBLIC_R2_URL`**（必須、R2 パブリック URL または API プロキシ）
- Provider キー
  - `RUNWARE_API_KEY`（必須）
- **Tavily API キー: `TAVILY_API_KEY`**（dynamic-prompt 用、任意）
- **CoinGecko API キー: `COINGECKO_API_KEY`**（任意、レート制限緩和用）
- **Solana RPC: `NEXT_PUBLIC_SOLANA_RPC_URL`**（任意、デフォルト: devnet）
- **IPFS: `PINATA_JWT`**（NFT メタデータアップロード用、任意）
- D1 データベース設定（Cloudflare Dashboard で設定）
  - `CLOUDFLARE_ACCOUNT_ID`（本番マイグレーション用）
  - `CLOUDFLARE_DATABASE_ID`（本番マイグレーション用）
  - `CLOUDFLARE_D1_TOKEN`（本番マイグレーション用）
- 任意（高速バッチアップロード: OpenNext Build/Deploy）
  - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CF_ACCOUNT_ID`

## ポート/実行

- Next.js 開発: 既定 3000
- Workers プレビュー: 既定 8787（`bun run preview`）
- 生成間隔: 10分ごと（`NEXT_PUBLIC_GENERATION_INTERVAL_MS=600000`）

## よく使うコマンド（package.json）

```bash
# 開発（Next.js）
bun run dev

# Cloudflare プレビュー（Cron テスト有）
bun run build:cf && bun run preview

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
bun run build          # Next.js ビルド
bun run build:cf       # OpenNext for Cloudflare ビルド
bun run deploy         # Cloudflare へデプロイ
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
- Provider 抽象化（`src/lib/image-generation-providers/*`）- Runware を本番プロバイダとして使用
- 純関数分離（`src/lib/pure/*`）でテスト容易性担保
- **D1 データベース統合** - Drizzle ORM による型安全なスキーマ定義とクエリ
- **動的プロンプト生成** - Tavily + Workers AI によるトークンコンテキストの自動生成とキャッシュ
- **環境変数検証: valibot** - `@t3-oss/env-nextjs` による型安全な環境変数管理
- **Cloudflare Cache API 統合** - Edge キャッシュによる最適化
- **Solana NFT ミント** - Metaplex + Irys による分散型所有権証明
