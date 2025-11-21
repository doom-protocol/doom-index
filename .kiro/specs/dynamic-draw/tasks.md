# 実装計画

## 概要

本実装計画は、CoinGecko Trending Search からユーザー検索ベースのトレンドトークンを取得し、または管理者が環境変数で指定したトークンリストから主役トークンを自動選定し、市場データと型安全な分類ロジックを組み合わせて PaintingContext を構築し、dynamic-prompt サービス経由で Runware FLUX kontext に画像生成を依頼する 1 時間ごとのバックエンドパイプラインを実装します。

## 実装タスク

- [x] 1. 外部 API クライアントの実装と統合
- [x] 1.1 CoinGecko TypeScript SDK の統合と腐敗防止層の実装
  - CoinGecko TypeScript SDK をプロジェクトに追加
  - CoinGeckoClient 腐敗防止層を実装し、外部 API の変更から内部ドメインを保護
  - Trending Search API、Coins List API、Coins Markets API、Global Market Data API の各エンドポイントをラップ
  - API レスポンスを内部ドメイン型に変換し、Result 型で返却
  - レート制限エラーとネットワークエラーの指数バックオフリトライを実装
  - _Requirements: 1A, 1B, 1C, 3, 11_

- [x] 1.2 Alternative.me Fear & Greed Index API クライアントの実装
  - AlternativeMeClient 腐敗防止層を実装し、Fear & Greed Index を取得
  - API レスポンスを内部ドメイン型に変換し、Result 型で返却
  - エラー時は警告ログを記録して null を返却し、処理を継続
  - _Requirements: 3, 11_

- [x] 1.3 外部 API クライアントのユニットテストの作成
  - CoinGeckoClient の各メソッドのユニットテストを作成（モック使用）
  - AlternativeMeClient のユニットテストを作成（モック使用）
  - エラーハンドリングとリトライロジックのテストを含める
  - _Requirements: 1A, 1B, 1C, 3, 10_

- [x] 2. データベーススキーマの設計と実装
- [x] 2.1 tokens テーブルのスキーマ定義とマイグレーション
  - Drizzle ORM で tokens テーブルのスキーマを定義
  - CoinGecko ID、symbol、name、logo URL、categories（JSON 配列文字列）、作成日時、更新日時のカラムを含める
  - symbol と coingecko_id のインデックスを作成
  - Drizzle Kit でマイグレーションを生成し、ローカル D1 で実行
  - _Requirements: 4, 8, 9_

- [x] 2.2 market_snapshots テーブルのスキーマ定義とマイグレーション
  - Drizzle ORM で market_snapshots テーブルのスキーマを定義
  - hourBucket（PRIMARY KEY）、グローバル市場データ（時価総額、取引高、変化率、ドミナンス）、Fear & Greed Index、作成日時、更新日時のカラムを含める
  - created_at のインデックスを作成
  - Drizzle Kit でマイグレーションを生成し、ローカル D1 で実行
  - _Requirements: 3, 8, 9, 10_

- [x] 2.3 データベーススキーマのエクスポートと接続ファクトリの更新
  - src/db/schema/index.ts に新しいテーブルスキーマをエクスポート
  - src/db/index.ts の DB 接続ファクトリを更新し、新しいスキーマを含める
  - _Requirements: 8_

- [x] 3. リポジトリ層の実装
- [x] 3.1 TokensRepository の実装
  - トークンメタ情報の CRUD 操作を実装
  - findById、insert、update、findRecentlySelected メソッドを実装
  - すべての操作で Result 型を返却し、エラーハンドリングを実装
  - 冪等性を保証するため onConflictDoNothing または onConflictDoUpdate を使用
  - _Requirements: 4, 9, 1D_

- [x] 3.2 MarketSnapshotsRepository の実装
  - グローバル市場スナップショットの CRUD 操作を実装
  - findByHourBucket、upsert メソッドを実装
  - すべての操作で Result 型を返却し、エラーハンドリングを実装
  - 同一 hourBucket のスナップショットは上書きされる（冪等性）
  - _Requirements: 3, 9, 10_

- [x] 3.3 リポジトリ層のユニットテストの作成
  - TokensRepository の各メソッドのユニットテストを作成（メモリ D1 使用）
  - MarketSnapshotsRepository の各メソッドのユニットテストを作成（メモリ D1 使用）
  - エラーハンドリングと冪等性のテストを含める
  - _Requirements: 4, 9, 10_

- [x] 4. データ取得層の実装
- [x] 4.1 TokenDataFetchService の実装
  - CoinGeckoClient を使用してトークンの詳細データを取得
  - Coins Markets エンドポイントで複数トークンを 1 回のリクエストで取得
  - API レスポンスを TokenCandidate 型に変換
  - source フラグ（coingecko-trending-search または force-override）と trendingRank または forcePriority を付与
  - _Requirements: 1A, 1B, 1C_

- [x] 4.2 MarketDataService の実装
  - CoinGeckoClient を使用してグローバル市場データを取得
  - AlternativeMeClient を使用して Fear & Greed Index を取得
  - MarketSnapshot 型を構築し、Fear & Greed Index の取得に失敗した場合は null を設定
  - MarketSnapshotsRepository を使用して D1 に保存
  - _Requirements: 3, 9_

- [x] 4.3 データ取得層の統合テストの作成
  - TokenDataFetchService の統合テストを作成（モック使用）
  - MarketDataService の統合テストを作成（モック使用）
  - エラーハンドリングとフォールバックロジックのテストを含める
  - _Requirements: 1A, 1B, 1C, 3, 10_

- [x] 5. トークン選定層の実装
- [x] 5.1 ScoringEngine の実装
  - トークン候補のスコアリングロジックを実装
  - trendScore、impactScore、moodScore、finalScore を計算する純粋関数を実装
  - trendScore は CoinGecko Trending Search rank と 24h volume から算出
  - impactScore は価格変動率、時価総額、取引高、TokenArchetype から算出
  - moodScore は MarketClimate と priceChange24h の一致度から算出
  - finalScore は 0.50 * trend + 0.35 * impact + 0.15 * mood で計算
  - _Requirements: 1D_

- [x] 5.2 TokenSelectionService の実装
  - トレンドトークンの候補集合から主役トークンを選定
  - FORCE_TOKEN_LIST 環境変数が設定されている場合は強制リストから選定
  - 強制リストが使用されている場合は重複選出チェックとステーブルコイン除外をスキップ
  - 通常フローでは ScoringEngine を使用して finalScore 最大のトークンを選定
  - 直近 24 時間で同一トークンが選出済みの場合は次点候補へ遷移
  - TokensRepository を使用してトークンメタ情報を取得・保存
  - _Requirements: 1B, 1D, 4, 9_

- [x] 5.3 トークン選定層のユニットテストの作成
  - ScoringEngine の各メソッドのユニットテストを作成
  - TokenSelectionService のユニットテストを作成（通常フローと強制リストフロー）
  - 重複選出チェック、ステーブルコイン除外、フォールバックロジックのテストを含める
  - _Requirements: 1B, 1D_

- [x] 6. コンテキスト構築層の実装
- [x] 6.1 分類関数の実装（lib/pure）
  - classifyMarketClimate 関数を実装し、MarketSnapshot から MarketClimate を決定
  - classifyTokenArchetype 関数を実装し、トークンカテゴリから TokenArchetype を決定
  - classifyEventPressure 関数を実装し、TokenSnapshot から EventKind と EventIntensity を決定
  - pickComposition 関数を実装し、MarketClimate、TokenArchetype、EventPressure から Composition を選択
  - pickPalette 関数を実装し、MarketClimate、TokenArchetype、EventPressure から Palette を選択
  - classifyDynamics 関数を実装し、TokenSnapshot から TrendDirection と VolatilityLevel を決定
  - deriveMotifs 関数を実装し、TokenArchetype から MotifTag 配列を派生
  - deriveNarrativeHints 関数を実装し、MarketClimate と EventPressure から NarrativeHints を派生
  - _Requirements: 5_

- [x] 6.2 PaintingContextBuilder の実装
  - SelectedToken と MarketSnapshot から PaintingContext を構築
  - 分類関数を呼び出して PaintingContext の 10 要素を決定
  - TokensRepository を使用してトークンメタ情報を取得
  - すべての分類関数は決定論的で、同じ入力に対して同じ出力を返す
  - _Requirements: 5_

- [x] 6.3 コンテキスト構築層のユニットテストの作成
  - 各分類関数のユニットテストを作成（すべての分類パターンをカバー）
  - PaintingContextBuilder のユニットテストを作成
  - 決定論性のテスト（同じ入力に対して同じ出力）を含める
  - _Requirements: 5_

- [ ] 7. 画像生成層の統合
- [x] 7.1 WorldPromptService の統合
  - 既存の WorldPromptService.composeTokenPrompt メソッドを使用
  - PaintingContext と TokenContext を統合した最終プロンプトを生成
  - TokenContext が D1 に存在しない場合は TokenContextService を呼び出して生成
  - _Requirements: 6_

- [ ] 7.2 ImageGenerationService の拡張
  - 既存の ImageGenerationService を拡張し、referenceImageUrl パラメータを追加
  - 新しい generateTokenImage メソッドを追加し、PaintingContext と referenceImageUrl を受け取る
  - Runware FLUX kontext モデルを使用して画像を生成
  - トークンロゴ画像を参照画像として Runware に渡す
  - _Requirements: 7_

- [ ] 7.3 画像生成層の統合テストの作成
  - WorldPromptService の統合テストを作成（モック使用）
  - ImageGenerationService の統合テストを作成（モック使用）
  - エラーハンドリングとリトライロジックのテストを含める
  - _Requirements: 6, 7, 10_

- [x] 8. オーケストレーション層の実装
- [x] 8.1 PaintingGenerationOrchestrator の実装
  - 既存の cron.ts を PaintingGenerationOrchestrator に置き換え
  - 1 時間ごとの絵画生成フロー全体を統括
  - hourBucket を生成し、MarketSnapshotsRepository で冪等性チェックを実行
  - 同一 hourBucket のスナップショットが既に存在する場合は処理をスキップ
  - TokenSelectionService、MarketDataService、PaintingContextBuilder、WorldPromptService、ImageGenerationService を順次呼び出し
  - PaintingsRepository を使用して生成結果を D1 と R2 に保存
  - すべてのエラーをログに記録し、Result 型で返却
  - _Requirements: 10, 12_

- [x] 8.2 Cron トリガの更新
  - wrangler.toml の cron トリガを 0 * * * *（毎時 0 分）に変更
  - 既存の 1 分ごとの生成 cron を削除
  - _Requirements: 10_

- [ ] 8.3 既存の market-cap サービスの削除
  - src/services/market-cap.ts を削除
  - DexScreener ベースのデータ取得フローを CoinGecko ベースのフローに置き換え
  - _Requirements: 1A, 1C, 3_

- [ ] 8.4 オーケストレーション層の統合テストの作成
  - PaintingGenerationOrchestrator のエンドツーエンドテストを作成（モックサービス使用）
  - 冪等性チェックのテスト（重複 hourBucket）
  - エラーハンドリングのテスト（API 失敗、D1 失敗）
  - _Requirements: 10, 12_

- [x] 9. 環境変数管理とセキュリティの実装
- [x] 9.1 環境変数の定義と検証
  - src/env.ts に新しい環境変数を追加
  - COINGECKO_API_KEY（オプション、Demo API の場合は不要）
  - FORCE_TOKEN_LIST（オプション、カンマ区切りのティッカーまたは CoinGecko ID 文字列）
  - RUNWARE_API_KEY（既存、必須）
  - @t3-oss/env-nextjs で型安全に検証
  - _Requirements: 11_

- [ ] 9.2 Cloudflare Secrets の設定
  - Cloudflare Workers の Secrets に COINGECKO_API_KEY と RUNWARE_API_KEY を設定
  - FORCE_TOKEN_LIST は環境変数として設定（機密情報ではないが管理者のみが設定可能）
  - _Requirements: 11_

- [ ] 9.3 セキュリティコントロールの実装
  - API キーをコード内にハードコードしない
  - FORCE_TOKEN_LIST のパース時に不正な形式を検証し、警告ログを記録
  - Drizzle ORM を使用してパラメータ化クエリを実行し、SQL インジェクションを防止
  - _Requirements: 11_

- [ ] 10. ロギングと可観測性の実装
- [ ] 10.1 ロギング戦略の実装
  - すべてのサービスで logger.info、logger.warn、logger.error、logger.debug を使用
  - FORCE_TOKEN_LIST が使用された場合は監査ログに記録
  - 主役トークンが選定された場合は tokenId、symbol、name、sources、scores をログに記録
  - 候補をスキップする場合はスキップ理由と finalScore をログに記録
  - すべてのエラーは errorType、message、provider、status、ticker などのコンテキスト情報を含める
  - _Requirements: 12_

- [ ] 10.2 エラーハンドリングの実装
  - すべてのサービスで Result 型を使用し、明示的なエラーハンドリングを実現
  - CoinGecko API のレート制限エラーとネットワークエラーは最大 3 回の指数バックオフリトライを実行
  - Alternative.me API のエラーは警告ログを記録して処理を継続
  - Runware API のタイムアウトはエラーログを記録し、cron 実行を停止
  - D1 と R2 の書き込みエラーはエラーログを記録し、cron 実行を停止
  - _Requirements: 10, 12_

- [ ] 10.3 可観測性の実装
  - Cloudflare Workers のダッシュボードで cron 実行の成功率とエラー率を監視
  - エラーログの頻度が閾値を超えた場合はアラートを発火（将来的な実装）
  - _Requirements: 12_

- [ ] 11. 手動実行スクリプトの実装とテスト
- [ ] 11.1 scripts/generate.ts の更新
  - 新しい PaintingGenerationOrchestrator を使用するように更新
  - FORCE_TOKEN_LIST 環境変数を設定してトークン選定をテスト
  - 生成された画像とメタデータを out/ ディレクトリに出力
  - _Requirements: 10_

- [ ] 11.2 手動実行テストの実行
  - scripts/generate.ts を使用して一連のフローを手動実行
  - 正常フロー: トークン選定 → コンテキスト構築 → プロンプト生成 → 画像生成 → ローカル保存
  - 強制リストフロー: FORCE_TOKEN_LIST 環境変数を設定してトークン選定をテスト
  - 生成された画像ファイルが正しいフォーマット（webp）で保存されることを確認
  - params.json にすべての必要なメタデータが含まれることを確認
  - _Requirements: 10_

- [ ] 12. 本番デプロイと検証
- [ ] 12.1 本番 D1 マイグレーションの実行
  - bun run db:migrate:prod を実行して本番 D1 にマイグレーションを適用
  - マイグレーションが正常に完了したことを確認
  - _Requirements: 8, 9_

- [ ] 12.2 Cloudflare Workers のデプロイ
  - bun run wrangler:deploy を実行して Cloudflare Workers をデプロイ
  - Cloudflare Workers のダッシュボードでデプロイが成功したことを確認
  - _Requirements: 10_

- [ ] 12.3 初回 cron 実行の監視
  - 初回 cron 実行を監視し、ログを確認
  - トークン選定、コンテキスト構築、プロンプト生成、画像生成、D1 保存が正常に実行されることを確認
  - 生成された絵画が R2 に保存され、D1 に記録されることを確認
  - _Requirements: 10, 12_

- [ ] 12.4 本番環境での継続的な監視
  - Cloudflare Workers のダッシュボードで cron 実行の成功率とエラー率を監視
  - エラーログを定期的に確認し、問題がある場合は修正
  - _Requirements: 12_

## 要件カバレッジ

すべての要件が上記のタスクでカバーされています：

- **Requirement 1A**: CoinGecko Trending Search Intake → Task 1.1, 4.1
- **Requirement 1B**: 管理者による候補トークンリストの強制上書き → Task 1.1, 5.2, 9.1, 10.1
- **Requirement 1C**: CoinGecko ID から詳細トークンデータの取得 → Task 1.1, 4.1
- **Requirement 1D**: CoinGecko Trending Search からの候補集合の構築とスコアリング → Task 5.1, 5.2
- **Requirement 2**: 主役トークンの市場データ取得 → Task 4.1
- **Requirement 3**: グローバル市場データ取得 → Task 1.1, 1.2, 4.2
- **Requirement 4**: トークンメタ情報の管理と取得 → Task 2.1, 3.1
- **Requirement 5**: PaintingContext の構築 → Task 6.1, 6.2
- **Requirement 6**: dynamic-prompt によるプロンプト生成 → Task 7.1
- **Requirement 7**: Runware FLUX kontext による画像生成 → Task 7.2
- **Requirement 8**: D1 データベーススキーマ設計 → Task 2.1, 2.2, 2.3
- **Requirement 9**: トークン情報と市場スナップショットの永続化 → Task 2.1, 2.2, 3.1, 3.2, 4.2
- **Requirement 10**: 冪等性とエラーハンドリング → Task 8.1, 10.2
- **Requirement 11**: セキュリティと環境変数管理 → Task 9.1, 9.2, 9.3
- **Requirement 12**: ロギングと可観測性 → Task 10.1, 10.2, 10.3

## 実装順序の注意事項

1. **外部 API クライアントとデータベーススキーマを最初に実装**: これらは他のすべてのコンポーネントの基盤となります
2. **リポジトリ層を次に実装**: データアクセス層を確立し、サービス層の実装を可能にします
3. **データ取得層とトークン選定層を並行して実装**: これらは独立したコンポーネントであり、並行開発が可能です
4. **コンテキスト構築層を実装**: トークン選定層の出力を受け取り、PaintingContext を構築します
5. **画像生成層を統合**: 既存のサービスを拡張し、新しいフローに統合します
6. **オーケストレーション層を実装**: すべてのコンポーネントを統合し、1 時間ごとの生成フローを実現します
7. **環境変数管理とロギングを実装**: セキュリティと可観測性を確保します
8. **手動実行スクリプトでテスト**: 本番デプロイ前にローカル環境で検証します
9. **本番デプロイと監視**: 本番環境にデプロイし、継続的に監視します

## 完了基準

- [ ] すべてのユニットテストと統合テストが合格
- [ ] scripts/generate.ts を使用した手動実行テストが成功し、out/ ディレクトリに画像とメタデータが出力される
- [ ] ローカル環境で cron が正常に実行される（bun run preview --test-scheduled）
- [ ] 本番環境で初回 cron が正常に実行され、絵画が生成される
- [ ] Cloudflare Workers のダッシュボードで cron 実行の成功率が 95% 以上
- [ ] すべての要件が実装され、要件カバレッジが 100%
