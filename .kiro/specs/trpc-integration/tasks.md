# 実装計画

## Phase 1: tRPCコア基盤構築

- [x] 1. tRPC関連パッケージのインストールと設定
- [x] 1.1 tRPCパッケージのインストール
  - プロジェクトに`@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@trpc/next`の最新安定版を追加
  - package.jsonの依存関係を更新し、既存のzodとneverthrowとの互換性を確認
  - TypeScript設定でstrict modeが有効であることを確認
  - _Requirements: 1.1_

- [x] 1.2 tRPC初期化とプロシージャヘルパーの実装
  - tRPCインスタンスを作成し、Context型を定義
  - プロシージャヘルパー（publicProcedure）を実装
  - ロギングミドルウェアを追加し、全プロシージャの実行時間を記録
  - zodエラーのフォーマッターを設定し、クライアントに適切なエラー情報を返す
  - _Requirements: 1.4, 7.1, 10.1_

- [x] 1.3 tRPCコンテキスト作成機能の実装
  - API Handler用のコンテキスト作成関数を実装し、リクエストヘッダーを抽出
  - Cloudflare Bindingsへのアクセス機能を実装し、KVとR2を注入
  - Server Component用のコンテキスト作成関数を実装
  - Bindingsが利用できない場合のフォールバック処理を追加
  - ロガーインスタンスをコンテキストに含める
  - _Requirements: 1.3, 5.2, 5.3_

- [x] 1.4 zodスキーマの定義
  - TokenTickerのenumスキーマを定義
  - Viewer関連の入力スキーマ（register, remove）を定義
  - Token関連の入力スキーマ（getState）を定義
  - R2関連の入力スキーマ（getObject）を定義
  - 型推論ヘルパー型をエクスポート
  - _Requirements: 6.1, 6.2, 6.6_

- [x] 1.5 tRPCクライアントの実装
  - TanStack Queryと統合されたtRPCクライアントを作成
  - httpBatchLinkを設定し、複数クエリの一括送信を有効化
  - ベースURLの環境別設定を実装（ローカル/Vercel/本番）
  - カスタムヘッダー設定機能を追加
  - _Requirements: 1.5, 10.2_

- [x] 1.6 tRPCサーバークライアントの実装
  - Server Component用のtRPCクライアント作成関数を実装
  - createCallerを使用した直接プロシージャ呼び出し機能を実装
  - Cron Job用のヘルパー関数を追加
  - _Requirements: 1.6, 4.1, 4.2, 5.4_

- [x] 1.7 コア基盤の単体テスト作成
  - tRPC Initのテスト（ミドルウェア実行順序、エラーフォーマット）
  - Context Creatorのテスト（Bindings注入、フォールバック動作）
  - zodスキーマのテスト（バリデーションルール、エラーメッセージ）
  - モックコンテキスト作成ヘルパーを実装
  - _Requirements: 8.1, 8.2_

## Phase 2: マーケットキャップルーターの実装

- [x] 2. マーケットキャップ取得機能のtRPC化
- [x] 2.1 MCルーターの実装
  - getMarketCapsクエリプロシージャを実装し、MarketCapServiceを呼び出す
  - getRoundedMcMapクエリプロシージャを実装
  - エラー時のゼロマップ返却ロジックを実装（既存挙動維持）
  - neverthrow ResultからtRPCErrorへの変換を実装
  - 構造化ログ出力を追加
  - _Requirements: 2.1, 2.5, 2.6, 7.1, 7.2, 7.3_

- [x] 2.2 MCルーターの単体テスト作成
  - 正常系テスト（MarketCapService成功時）
  - エラー系テスト（サービス層エラー時のゼロマップ返却）
  - モックされたコンテキストとサービスを使用
  - _Requirements: 8.1, 8.2, 8.5_

- [x] 2.3 MCルーターの統合テスト作成
  - 実際のサービス層を使用したE2Eテスト
  - 外部API（DexScreener）のモック化
  - レスポンスタイムの測定
  - _Requirements: 8.3, 8.5, 10.1_

## Phase 3: Viewerルーターの実装

- [x] 3. Viewer登録・削除機能のtRPC化
- [x] 3.1 Viewerルーターの実装
  - registerミューテーションプロシージャを実装
  - removeミューテーションプロシージャを実装
  - Bot User-Agent検出ロジックを統合（リクエストヘッダーと入力の両方）
  - KV Namespace未設定時のエラーハンドリングを実装
  - ViewerServiceの呼び出しとエラー変換を実装
  - _Requirements: 2.2, 2.5, 2.6, 7.1, 7.2, 7.3_

- [x] 3.2 Viewerルーターの単体テスト作成
  - 正常系テスト（Viewer登録・削除成功）
  - Bot検出テスト（403エラー返却）
  - KV未設定テスト（500エラー返却）
  - バリデーションエラーテスト（sessionId未指定）
  - _Requirements: 8.1, 8.2, 8.5_

- [x] 3.3 Viewerルーターの統合テスト作成
  - KVへの実際の書き込み・削除テスト
  - セッションタイムアウトのテスト
  - 並行リクエストのテスト
  - _Requirements: 8.3, 8.5_

## Phase 4: Tokenルーターの実装

- [x] 4. トークン状態取得機能のtRPC化
- [x] 4.1 Tokenルーターの実装
  - getStateクエリプロシージャを実装
  - tickerパラメータのzodバリデーションを実装
  - R2からのトークン状態取得ロジックを実装
  - 存在しないトークン状態の場合のnull返却を実装
  - R2アクセスエラーのハンドリングを実装
  - _Requirements: 2.3, 2.5, 2.6, 6.3, 7.1, 7.2_

- [x] 4.2 Tokenルーターの単体テスト作成
  - 正常系テスト（トークン状態取得成功）
  - 不正なtickerテスト（zodバリデーションエラー）
  - 存在しないトークンテスト（null返却）
  - R2アクセスエラーテスト
  - _Requirements: 8.1, 8.2, 8.5_

- [x] 4.3 Tokenルーターの統合テスト作成
  - R2からの実際のデータ取得テスト
  - 全8種類のトークンに対するテスト
  - キャッシュ動作の検証
  - _Requirements: 8.3, 8.5_

## Phase 5: R2ルーターの実装

- [x] 5. R2オブジェクト取得機能のtRPC化
- [x] 5.1 R2ルーターの実装
  - getObjectクエリプロシージャを実装
  - キーパスの正規化ロジックを実装
  - R2公開URLを返す方式を実装（ストリーミング制限対応）
  - オブジェクトメタデータ（etag, size, uploaded）の返却を実装
  - オブジェクト未発見時の404エラーハンドリングを実装
  - _Requirements: 2.4, 2.5, 2.6, 7.1, 7.2, 10.5_

- [x] 5.2 R2ルーターの単体テスト作成
  - 正常系テスト（オブジェクトメタデータ取得成功）
  - 不正なキーテスト（バリデーションエラー）
  - オブジェクト未発見テスト（404エラー）
  - キーパス正規化のテスト
  - _Requirements: 8.1, 8.2, 8.5_

- [x] 5.3 R2ルーターの統合テスト作成
  - R2からの実際のオブジェクト取得テスト
  - 公開URL生成の検証
  - 大容量ファイルのメタデータ取得テスト
  - _Requirements: 8.3, 8.5_

## Phase 6: Appルーターの統合とAPI Handlerの実装

- [x] 6. tRPCルーターの統合とHTTPエンドポイントの公開
- [x] 6.1 Appルーターの実装
  - メインルーターを作成し、全サブルーターを統合
  - AppRouter型をエクスポートし、クライアント型推論を有効化
  - ルーター構造の一貫性を確認
  - _Requirements: 1.2, 2.x全般_

- [x] 6.2 tRPC API Handlerの実装
  - Next.js API Route統合を実装
  - Edge Runtime設定を追加
  - コンテキスト作成とルーター実行を統合
  - グローバルエラーハンドラーを設定し、全エラーをロギング
  - _Requirements: 1.2, 5.1, 7.5, 7.6_

- [x] 6.3 API Handlerの統合テスト作成
  - HTTPリクエスト経由での全プロシージャ呼び出しテスト
  - バッチリクエストのテスト
  - エラーレスポンスのフォーマット検証
  - Edge Runtime互換性の確認
  - _Requirements: 8.3, 8.5, 10.2_

## Phase 7: クライアント統合とProvider実装

- [x] 7. React ProviderとtRPCクライアントの統合
- [x] 7.1 TRPCReactProviderの実装
  - 既存ProvidersコンポーネントにtRPC Providerを追加
  - tRPCクライアントとQueryClientの初期化を実装
  - クライアントインスタンスの安定化（useStateで1度だけ作成）
  - 既存のuseViewer統合を維持
  - _Requirements: 3.4, 10.2_

- [x] 7.2 useMcフックのtRPC移行
  - trpc.mc.getMarketCaps.useQueryを使用した実装に書き換え
  - 既存のrefetchInterval（10秒）とstaleTime（10秒）を維持
  - 型推論による自動型補完を確認
  - エラーハンドリングを実装
  - _Requirements: 3.1, 3.5, 7.4, 10.3_

- [x] 7.3 useTokenImageフックのtRPC移行
  - trpc.token.getState.useQueryを使用した実装に書き換え
  - tickerパラメータの型安全な受け渡しを実装
  - staleTime 60秒、refetchOnWindowFocus falseを設定
  - null返却時のハンドリングを実装
  - _Requirements: 3.2, 3.5, 7.4, 10.3_

- [x] 7.4 クライアントフックの単体テスト作成
  - useMcフックのテスト（データ取得、リフェッチ、エラー）
  - useTokenImageフックのテスト（データ取得、null処理、エラー）
  - tRPCモックプロバイダーを使用
  - _Requirements: 8.4, 8.5_

## Phase 8: Web Worker統合

- [x] 8. Web WorkerからのtRPC呼び出し実装
- [x] 8.1 Viewer Worker のtRPC移行
  - vanilla tRPCクライアントをWorker内で初期化
  - trpc.viewer.register.mutateの実装
  - trpc.viewer.remove.mutateの実装
  - Worker環境でのエラーハンドリングを実装
  - ハートビート送信ロジックをtRPCベースに書き換え
  - _Requirements: 3.3, 3.6_

- [x] 8.2 Viewer Workerの統合テスト作成
  - Worker起動とtRPCクライアント初期化のテスト
  - Viewer登録・削除のE2Eテスト
  - Bot検出時の動作テスト
  - Worker終了時のクリーンアップテスト
  - _Requirements: 8.3, 8.5_

## Phase 9: Server Component統合

- [x] 9. Server ComponentsからのtRPC呼び出し実装
- [x] 9.1 Server Componentでのデータ取得実装
  - getServerTRPCヘルパーを使用したデータ取得を実装
  - 主要ページでのマーケットキャップデータのプリフェッチを実装
  - エラーバウンダリとフォールバックUIを実装
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [x] 9.2 HydrationBoundaryの実装
  - Server ComponentとClient Componentのデータ共有を実装
  - 初期データのプリフェッチを実装
  - ウォーターフォール削減の検証
  - _Requirements: 4.4, 10.4_

- [x] 9.3 Server Component統合のE2Eテスト作成
  - ページロード時のデータ取得テスト
  - HydrationBoundaryの動作検証
  - エラーバウンダリのテスト
  - _Requirements: 8.3, 8.5_

## Phase 10: Cron Job統合

- [x] 10. Cron JobからのtRPC呼び出し実装
- [x] 10.1 Cron処理のtRPC移行
  - createServerTRPCClientを使用したCron処理の書き換え
  - マーケットキャップ取得処理のtRPC化
  - エラーハンドリングとリトライロジックの実装
  - _Requirements: 5.4_

- [x] 10.2 Cron統合テスト作成
  - Cron Triggerのシミュレーションテスト
  - tRPCプロシージャ呼び出しの検証
  - エラー時のリトライ動作テスト
  - _Requirements: 8.3, 8.5_

## Phase 11: パフォーマンス最適化

- [x] 11. パフォーマンス測定と最適化
- [x] 11.1 パフォーマンスロギングの実装
  - 各プロシージャの実行時間測定を実装
  - レスポンスタイムのp95計測を実装
  - パフォーマンスメトリクスの構造化ログ出力を実装
  - _Requirements: 10.1, 10.6, 10.7_

- [x] 11.2 キャッシュ戦略の最適化
  - TanStack QueryのstaleTime/cacheTime設定を最適化
  - バッチリクエストの効率を検証
  - キャッシュヒット率の測定を実装
  - _Requirements: 10.2, 10.3_

- [x] 11.3 パフォーマンステスト作成
  - バッチリクエストの効率テスト（3クエリ以上で1リクエスト）
  - Server Componentsプリフェッチのウォーターフォール削減テスト
  - キャッシュヒット率の測定テスト
  - レスポンスタイムのp95 < 100ms検証
  - _Requirements: 8.3, 10.1-10.7_

## Phase 12: 既存API Routes削除とクリーンアップ

- [x] 12. 既存実装の削除と最終検証
- [x] 12.1 既存API Routesの削除
  - 全tRPC機能の動作確認完了後、既存API Routesファイルを削除
  - src/app/api/mc/route.tsの削除 ✓
  - src/app/api/viewer/route.tsの削除 ✓
  - src/app/api/tokens/[ticker]/route.tsの削除 ✓
  - src/app/api/r2/[...key]/route.tsの削除 ✓
  - _Requirements: 2.7_

- [x] 12.2 最終統合テストの実行
  - 全プロシージャの統合テスト実行
  - E2Eテストスイート実行
  - パフォーマンステスト実行
  - テストカバレッジ80%以上の確認
  - _Requirements: 8.3, 8.6, 8.7_

- [x] 12.3 ローカル開発環境での動作確認
  - bun run devでの動作確認
  - bun run previewでの動作確認
  - 全機能の手動テスト実行
  - _Requirements: 5.5_

- [x] 12.4 本番ビルドとデプロイ検証
  - opennextjs-cloudflareビルドの実行
  - tRPCルーターの正しいバンドル確認
  - Edge Runtime互換性の最終確認
  - _Requirements: 5.6_

## Phase 13: ドキュメント作成

- [x] 13. ドキュメントとマイグレーションガイドの作成
- [x] 13.1 tRPCアーキテクチャドキュメントの作成
  - ディレクトリ構造の説明を記載
  - 命名規則とコーディング規約を記載
  - 設計原則とアーキテクチャパターンを記載
  - _Requirements: 9.1_

- [x] 13.2 マイグレーションガイドの作成
  - 既存API Routesからの移行手順を段階的に記載
  - ロールバック手順を記載
  - トラブルシューティング情報を記載
  - _Requirements: 9.2, 9.4_

- [x] 13.3 開発者向けガイドの作成
  - 新規プロシージャの追加方法を説明
  - エラーハンドリングパターンを説明
  - テスト方法を説明
  - コード例を豊富に含める
  - _Requirements: 9.3, 9.5_

- [x] 13.4 READMEの更新
  - tRPC関連のセクションを追加
  - セットアップ手順を更新
  - 開発ワークフローを更新
  - _Requirements: 9.6_
