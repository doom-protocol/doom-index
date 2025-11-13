---
title: DOOM INDEX - プロジェクト構造と規約
includes: always
updated: 2025-11-13
---

## ルート構成（概要）
- `src/` アプリケーション本体
- `scripts/` 生成・補助 CLI
- `tests/` unit/integration テスト
- `public/` 静的アセット（OGP 既定画像等）
- `docs/` 仕様・背景ドキュメント
- `.kiro/` Kiro（ステアリング/スペック）
- 構成ファイル: `package.json`, `tsconfig.json`, `wrangler.toml`, `open-next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`

## `src/` 詳細
- `app/` Next.js App Router
  - `api/` エッジ API ルート（MC, R2, tokens, viewer）
  - `opengraph-image.tsx` 動的 OGP 画像
  - `layout.tsx`, `page.tsx`, `globals.css`, `providers.tsx`
- `components/`
  - `gallery/` 3D シーン（camera-rig, framed-painting, lights, scene）
  - `ui/` UI コンポーネント（トップバー、リアルタイム表示 等）
  - `icons/` アイコン群
- `constants/` 固定値・プロンプト・トークン定義
- `hooks/` React hooks（グローバル状態、MC、画像、viewer）
- `lib/`
  - `providers/` 画像生成 Provider 実装（ai-sdk, runware, mock, index）
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

## 命名規約・配置
- ファイル/ディレクトリ: 原則ケバブケース（TypeScript 型はパスカルケース）
- React コンポーネント: `*.tsx`、フォルダ co-location（スタイル/補助は近傍に配置）
- 純関数: `src/lib/pure/*` に集約（副作用のない計算を明示）
- Provider 実装: `src/lib/providers/*` に実装し、`index.ts` で解決
- サービス層: `src/services/*` にユースケース別に分割
- API ルート: `src/app/api/*/route.ts`（Edge 前提、読み取り中心）

## インポート規約
- パスエイリアス: `@/*`（`tsconfig.json` `paths`）
- 外部 -> 内部の順（外部ライブラリ → `@/*`）
- 循環参照を避ける（サービス→UIの逆流を禁止）

## アーキテクチャ原則
- Edge ファースト・I/O分離（副作用は境界で実行）
- 結果型（neverthrow）で明示的に失敗を伝播
- 純関数と状態/副作用の分離でテスト容易性を担保
- Provider 抽象化でモデル・実行環境差を吸収
- R2 は Workers では Binding、Next.js では公開 URL を使用

## 追加の作法
- 新機能: `.kiro/specs/<feature>/` に要件→設計→タスクを定義し、実装へ
- コンポーネント: 近接配置（styles/hooks/utils を隣接）
- テスト: `tests/unit/..`, `tests/integration/..` に対応配置
- OGP/公開物: 既定は `public/`、動的は `app/opengraph-image.tsx`

## 変更の指針
- 既存のディレクトリ構造に合わせる（不要な階層を増やさない）
- セマンティック分割（似た概念は抽象化/統合）
- 命名は目的を表す完全語を優先（省略語は避ける）
