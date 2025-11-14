# Requirements Document

## Introduction

DOOM INDEXプロジェクトにtRPCを導入し、フロントエンドとバックエンド間のAPI通信を型安全に実装します。現在、Next.js App RouterのAPI Routes（`/api/mc`, `/api/viewer`, `/api/tokens/[ticker]`, `/api/r2/[...key]`）を使用していますが、これらを全てtRPCベースの実装に移行します。tRPCの導入により、エンドツーエンドの型安全性を確保し、TanStack QueryおよびReact Server Componentsとの統合を実現します。これにより、開発体験の向上、実行時エラーの削減、リファクタリングの安全性向上、APIドキュメントの自動生成といったビジネス価値を提供します。

## Requirements

### Requirement 1: tRPCコア基盤の構築

**Objective:** 開発者として、tRPCの基本的なセットアップを完了し、型安全なAPI通信の基盤を確立したい。これにより、以降のAPI実装が一貫した方法で行えるようになる。

#### Acceptance Criteria

1. WHEN プロジェクトにtRPC関連パッケージをインストールする THEN システムは `@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@trpc/next` の最新安定版をdependenciesに追加する
2. WHEN tRPCルーターの基本構造を定義する THEN システムは `src/server/trpc/` ディレクトリ配下に `context.ts`, `router.ts`, `trpc.ts` を作成する
3. WHEN tRPCコンテキストを作成する THEN システムは Next.js App Routerのリクエストヘッダー、Cloudflare環境変数（KV, R2 Bindings）、ロガーインスタンスをコンテキストに含める
4. WHEN tRPCの初期化処理を実装する THEN システムは neverthrowによるエラーハンドリング、zodによるバリデーション、型安全なプロシージャ定義をサポートする
5. WHEN クライアント側のtRPCセットアップを実装する THEN システムは `src/lib/trpc/client.ts` にTanStack Queryと統合されたtRPCクライアントを作成する
6. WHEN React Server ComponentsからtRPCを利用する THEN システムは `src/lib/trpc/server.ts` にサーバーサイド専用のtRPCクライアントを作成する

### Requirement 2: 既存API Routes のtRPC移行

**Objective:** 開発者として、現在のREST API Routes（`/api/mc`, `/api/viewer`, `/api/tokens/[ticker]`, `/api/r2/[...key]`）を全てtRPCプロシージャに置き換えたい。これにより、型安全性を確保しつつ既存機能を維持する。

#### Acceptance Criteria

1. WHEN `/api/mc` エンドポイントをtRPCに移行する THEN システムは `mc.getMarketCaps` クエリプロシージャを作成し、`McMap` 型と `generatedAt` を返す
2. WHEN `/api/viewer` エンドポイントをtRPCに移行する THEN システムは `viewer.register` および `viewer.remove` ミューテーションプロシージャを作成し、セッションID、ユーザーエージェント、bye フラグを入力として受け取る
3. WHEN `/api/tokens/[ticker]` エンドポイントをtRPCに移行する THEN システムは `token.getState` クエリプロシージャを作成し、ticker パラメータをzodでバリデーションし、`TokenState` 型を返す
4. WHEN `/api/r2/[...key]` エンドポイントをtRPCに移行する THEN システムは `r2.getObject` クエリプロシージャを作成し、R2オブジェクトのストリーミングレスポンスを返す
5. WHEN 各プロシージャで既存のサービス層を呼び出す THEN システムは `createMarketCapService`, `createViewerService`, `resolveR2Bucket` などの既存実装を再利用する
6. WHEN プロシージャでエラーが発生する THEN システムは neverthrow の Result 型を活用し、適切なtRPCErrorに変換する
7. WHEN 全てのプロシージャを実装完了する THEN システムは既存のAPI Routes ファイル（`src/app/api/mc/route.ts`, `src/app/api/viewer/route.ts`, `src/app/api/tokens/[ticker]/route.ts`, `src/app/api/r2/[...key]/route.ts`）を削除する

### Requirement 3: クライアントフックのtRPC統合

**Objective:** フロントエンド開発者として、既存のTanStack Query フック（`useMc`, `useTokenImage`, `useViewer`）をtRPCベースの実装に置き換えたい。これにより、型補完とエラーハンドリングが自動化される。

#### Acceptance Criteria

1. WHEN `useMc` フックをtRPCに移行する THEN システムは `trpc.mc.getMarketCaps.useQuery()` を使用し、既存のrefetchInterval（10秒）とstaleTime（10秒）を維持する
2. WHEN `useTokenImage` フックをtRPCに移行する THEN システムは `trpc.token.getState.useQuery()` を使用し、ticker パラメータを型安全に渡す
3. WHEN `useViewer` フックをtRPCに移行する THEN システムは Web Worker 内から `trpc.viewer.register.mutate()` および `trpc.viewer.remove.mutate()` を呼び出す
4. WHEN クライアントコンポーネントでtRPCフックを使用する THEN システムは `src/app/providers.tsx` で `TRPCReactProvider` をラップし、TanStack QueryのQueryClientを提供する
5. WHEN 既存フックファイルを更新完了する THEN システムは `src/hooks/use-mc.ts`, `src/hooks/use-token-image.ts` の実装をtRPCベースに書き換える
6. WHEN Web Worker内でtRPCを使用する THEN システムは `src/workers/viewer.worker.ts` でvanilla tRPCクライアントを初期化し、ミューテーションを実行する

### Requirement 4: React Server Components との統合

**Objective:** サーバーコンポーネント開発者として、tRPCをReact Server Componentsから直接呼び出したい。これにより、初期データフェッチを型安全に実行できる。

#### Acceptance Criteria

1. WHEN Server ComponentからtRPCを呼び出す THEN システムは `src/lib/trpc/server.ts` で定義されたサーバー専用クライアントを使用する
2. WHEN サーバーサイドでtRPCコンテキストを作成する THEN システムは Next.js の `headers()` 関数および Cloudflare Bindings を注入する
3. WHEN Server Component内でデータを取得する THEN システムは `await trpc.mc.getMarketCaps()` のように直接プロシージャを呼び出す
4. WHEN Server ComponentとClient Componentでデータを共有する THEN システムは TanStack Query の `HydrationBoundary` を使用して初期データをプリフェッチする
5. WHEN サーバーサイドでエラーが発生する THEN システムは neverthrow の Result 型を適切にハンドリングし、エラーバウンダリまたはフォールバックUIを表示する

### Requirement 5: Edge Runtime 対応とCloudflare統合

**Objective:** インフラ担当者として、tRPCがCloudflare Pages + Workers環境で正常に動作することを保証したい。これにより、本番環境でのパフォーマンスと安定性を確保する。

#### Acceptance Criteria

1. WHEN tRPCをEdge Runtimeで実行する THEN システムは Next.js の `export const runtime = 'edge'` 設定を適用し、Node.js専用APIを使用しない
2. WHEN Cloudflare Bindingsにアクセスする THEN システムは `@opennextjs/cloudflare` の `getCloudflareContext()` を使用してKV, R2, 環境変数を取得する
3. WHEN tRPCコンテキストでBindingsを利用する THEN システムは `VIEWER_KV`, `DOOM_INDEX_BUCKET` などのBindingsを型安全に注入する
4. WHEN Workers Cron TriggerからtRPCを呼び出す THEN システムは `src/cron.ts` でサーバーサイドtRPCクライアントを使用する
5. WHEN ローカル開発環境でtRPCをテストする THEN システムは `bun run dev` および `bun run preview` で正常に動作する
6. WHEN 本番環境にデプロイする THEN システムは `opennextjs-cloudflare` によるビルドプロセスでtRPCルーターが正しくバンドルされる

### Requirement 6: 型定義とバリデーションの統合

**Objective:** 開発者として、zodスキーマを活用した入力バリデーションと型推論を実現したい。これにより、実行時エラーを防ぎ、開発体験を向上させる。

#### Acceptance Criteria

1. WHEN プロシージャの入力スキーマを定義する THEN システムは zodスキーマを使用し、`input` プロパティで宣言する
2. WHEN 既存の型定義を再利用する THEN システムは `src/types/domain.ts` の `McMap`, `TokenState`, `TokenTicker` などをzodスキーマに変換する
3. WHEN バリデーションエラーが発生する THEN システムは tRPCの `BAD_REQUEST` エラーを返し、詳細なエラーメッセージを含める
4. WHEN クライアント側で型推論を利用する THEN システムは `AppRouter` 型から自動的に入力・出力型を推論する
5. WHEN 複雑なバリデーションロジックを実装する THEN システムは zodの `.refine()` や `.transform()` メソッドを活用する
6. WHEN 共通のスキーマを定義する THEN システムは `src/server/trpc/schemas/` ディレクトリに再利用可能なzodスキーマを配置する

### Requirement 7: エラーハンドリングとロギングの統合

**Objective:** 運用担当者として、tRPC経由のエラーを適切にハンドリングし、ロギングシステムと統合したい。これにより、問題の早期発見と対応が可能になる。

#### Acceptance Criteria

1. WHEN プロシージャ内でエラーが発生する THEN システムは neverthrow の `Result.isErr()` を判定し、適切なtRPCErrorに変換する
2. WHEN サービス層からエラーが返される THEN システムは エラー型（network, notFound, validation等）に応じて適切なHTTPステータスコードを設定する
3. WHEN tRPCエラーをロギングする THEN システムは `src/utils/logger` の `logger.error()` を使用し、構造化ログを出力する
4. WHEN クライアント側でエラーをハンドリングする THEN システムは TanStack Query の `onError` コールバックでユーザーフレンドリーなエラーメッセージを表示する
5. WHEN グローバルエラーハンドラーを設定する THEN システムは tRPCの `onError` オプションで全てのエラーをキャッチし、ロギングする
6. WHEN エラーの詳細情報を記録する THEN システムは リクエストID、ユーザーエージェント、タイムスタンプ、スタックトレースを含める

### Requirement 8: テスト戦略とカバレッジ

**Objective:** QA担当者として、tRPC実装に対する包括的なテストスイートを構築したい。これにより、リグレッションを防ぎ、品質を保証する。

#### Acceptance Criteria

1. WHEN tRPCプロシージャの単体テストを作成する THEN システムは `tests/unit/server/trpc/` 配下に各プロシージャのテストファイルを配置する
2. WHEN プロシージャをテストする THEN システムは モックされたコンテキスト（KV, R2, logger）を注入し、サービス層の依存を分離する
3. WHEN 統合テストを実装する THEN システムは `tests/integration/server/trpc/` 配下にエンドツーエンドのテストを配置する
4. WHEN クライアントフックをテストする THEN システムは `@testing-library/react` と `@testing-library/react-hooks` を使用し、tRPCモックプロバイダーを提供する
5. WHEN エラーケースをテストする THEN システムは 不正な入力、ネットワークエラー、サービス層のエラーをカバーする
6. WHEN テストカバレッジを測定する THEN システムは 全てのプロシージャ、エラーハンドリング、バリデーションロジックが80%以上のカバレッジを達成する
7. WHEN CI/CDパイプラインでテストを実行する THEN システムは `bun test` コマンドで全てのtRPC関連テストが成功する

### Requirement 9: ドキュメントとマイグレーションガイド

**Objective:** 開発チームメンバーとして、tRPC導入に関する包括的なドキュメントとマイグレーションガイドを参照したい。これにより、スムーズな移行と知識共有が実現する。

#### Acceptance Criteria

1. WHEN tRPCアーキテクチャドキュメントを作成する THEN システムは `docs/trpc-architecture.md` にディレクトリ構造、命名規則、設計原則を記載する
2. WHEN マイグレーションガイドを作成する THEN システムは `docs/trpc-migration.md` に既存API Routesからの移行手順を段階的に記載する
3. WHEN 開発者向けガイドを作成する THEN システムは 新規プロシージャの追加方法、エラーハンドリングパターン、テスト方法を説明する
4. WHEN トラブルシューティングガイドを作成する THEN システムは よくある問題とその解決方法をFAQ形式で記載する
5. WHEN コード例を提供する THEN システムは クエリ、ミューテーション、Server Component統合、エラーハンドリングの実例を含める
6. WHEN ドキュメントを更新する THEN システムは `README.md` にtRPC関連のセクションを追加し、セットアップ手順を記載する

### Requirement 10: パフォーマンス最適化と監視

**Objective:** パフォーマンスエンジニアとして、tRPC実装のパフォーマンスを最適化し、監視可能にしたい。これにより、ユーザー体験を向上させる。

#### Acceptance Criteria

1. WHEN tRPCリクエストのレスポンスタイムを測定する THEN システムは 各プロシージャの実行時間をロギングする
2. WHEN バッチリクエストを実装する THEN システムは tRPCの `httpBatchLink` を使用し、複数のクエリを1つのHTTPリクエストにまとめる
3. WHEN キャッシュ戦略を最適化する THEN システムは TanStack Query の `staleTime`, `cacheTime`, `refetchInterval` を適切に設定する
4. WHEN Server Componentsでプリフェッチを実装する THEN システムは 初期ページロード時に必要なデータを事前取得し、ウォーターフォールを削減する
5. WHEN R2オブジェクトのストリーミングを最適化する THEN システムは tRPCレスポンスでストリーミングをサポートし、大容量ファイルのメモリ使用量を削減する
6. WHEN パフォーマンスメトリクスを監視する THEN システムは Cloudflare Analytics および カスタムログで tRPCエンドポイントのレイテンシ、エラー率、スループットを追跡する
7. WHEN パフォーマンスボトルネックを特定する THEN システムは 各プロシージャの実行時間を分析し、最適化の優先順位を決定する
