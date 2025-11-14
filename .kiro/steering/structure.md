---
title: DOOM INDEX - プロジェクト構造と規約
includes: always
updated: 2025-01-27
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
  - `icons/` アイコン群
- `constants/` 固定値・プロンプト・トークン定義
- `hooks/` React hooks（グローバル状態、MC、画像、viewer、tRPC 統合）
- `lib/`
  - `trpc/` **tRPC クライアント実装**
    - `client.ts` クライアントサイド tRPC クライアント（TanStack Query 統合）
    - `server.ts` サーバーサイド tRPC クライアント（Server Components 用）
    - `vanilla-client.ts` vanilla tRPC クライアント（Web Workers 用）
  - `providers/` 画像生成 Provider 実装（ai-sdk, runware, mock, index）
  - `cache.ts` **Cloudflare Cache API ヘルパー（開発中）**
  - `r2.ts` R2 クライアント（環境差吸収）
  - `pure/` 純関数（プロンプト合成/正規化/量子化/ハッシュ）
  - 共通: `hash.ts`, `round.ts`, `time.ts`, `runware-client.ts`, `kv.ts`
- `services/` ビジネスロジック
  - `generation.ts` 生成エンジン
  - `market-cap.ts` 指標取得
  - `prompt.ts` プロンプト作成
  - `state.ts` 状態管理（R2 永続化）
  - `revenue.ts` 収益レポート
  - `viewer.ts` 閲覧者関連
  - `container.ts` 実行環境 DI（Workers/Next.js）
- `types/` 型定義（ドメイン、OpenNext、エラー、ワーカー設定 等）
- `utils/` 画像/URL/UA/ロガー/エラー ユーティリティ
- `workers/` ワーカーロジック（例: viewer.worker.ts）
- `worker.ts` エントリ
- `cron.ts` Cloudflare Workers Cron Handler

## 命名規約・配置

- ファイル/ディレクトリ: 原則ケバブケース（TypeScript 型はパスカルケース）
- React コンポーネント: `*.tsx`、フォルダ co-location（スタイル/補助は近傍に配置）
- **tRPC ルーター: `src/server/trpc/routers/[domain].ts`**（例: `mc.ts`, `viewer.ts`）
- **tRPC スキーマ: `src/server/trpc/schemas/index.ts`**（共通スキーマを集約）
- **tRPC クライアント: `src/lib/trpc/[type]-client.ts`**（React/Server/Vanilla）
- 純関数: `src/lib/pure/*` に集約（副作用のない計算を明示）
- Provider 実装: `src/lib/providers/*` に実装し、`index.ts` で解決
- サービス層: `src/services/*` にユースケース別に分割
- API ルート: `src/app/api/trpc/[trpc]/route.ts`（tRPC HTTP エンドポイント、Edge 前提）

## インポート規約

- パスエイリアス: `@/*`（`tsconfig.json` `paths`）
- 外部 -> 内部の順（外部ライブラリ → `@/*`）
- 循環参照を避ける（サービス→UIの逆流を禁止）

## アーキテクチャ原則

- Edge ファースト・I/O分離（副作用は境界で実行）
- **tRPC による型安全 API** - エンドツーエンドの型推論、zod バリデーション、エラーハンドリング
- 結果型（neverthrow）で明示的に失敗を伝播（tRPC プロシージャ内で Result 型を tRPCError に変換）
- 純関数と状態/副作用の分離でテスト容易性を担保
- Provider 抽象化でモデル・実行環境差を吸収
- R2 は Workers では Binding、Next.js では公開 URL を使用
- **Cloudflare Cache API 統合（開発中）** - Edge キャッシュによる外部 API 呼び出し削減とレイテンシ低減

## 追加の作法

- 新機能: `.kiro/specs/<feature>/` に要件→設計→タスクを定義し、実装へ
- **tRPC プロシージャ追加時**: `src/server/trpc/routers/[domain].ts` に追加、スキーマは `schemas/index.ts` に定義
- **tRPC クライアント使用**: React コンポーネントでは `lib/trpc/client.ts` 経由、Server Components では `lib/trpc/server.ts` 経由
- コンポーネント: 近接配置（styles/hooks/utils を隣接）
- テスト: `tests/unit/..`, `tests/integration/..` に対応配置（tRPC ルーター/コンテキストの統合テスト含む）
- OGP/公開物: 既定は `public/`、動的は `app/opengraph-image.tsx`

## 変更の指針

- 既存のディレクトリ構造に合わせる（不要な階層を増やさない）
- セマンティック分割（似た概念は抽象化/統合）
- 命名は目的を表す完全語を優先（省略語は避ける）
