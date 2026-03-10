# Requirements Document

## Introduction

DOOM INDEX の自動生成パイプラインにおいて、動的に選定されたトークンに対して固有のナラティブ・性質・象徴性を付与するための dynamic-prompt 機能を実装する。本機能は以下の3つの主要コンポーネントから構成される：

1. **Workers AI クライアント** - Cloudflare Workers AI をラップした汎用的かつ型安全なテキスト生成クライアント
2. **Tavily 検索統合** - Tavily Search API を用いたトークン情報の Web 検索と要約
3. **トークンコンテキスト生成** - 上記2つを組み合わせて、トークン固有の短い英語コンテキスト（short_context）を生成し、D1 にキャッシュする機能

dynamic-prompt は既存の DOOM INDEX プロジェクトアーキテクチャ（Next.js + Drizzle ORM + Cloudflare Workers）に準拠し、neverthrow ベースの関数型エラーハンドリングおよびロギングユーティリティ（`utils/logger`）を再利用する。HTTP API エンドポイントは公開せず、cron ジョブなどサーバー側の内部処理からのみ呼び出される。

## Requirements

### Requirement 1: Workers AI クライアントによる汎用テキスト生成

**Objective:** システム開発者として、Cloudflare Workers AI を型安全かつ統一的に呼び出せるクライアントを利用したい。これにより、プロンプト生成やトークンコンテキスト生成などの AI 依存処理を一貫したインターフェイスで実装できる。

#### Acceptance Criteria

1. WHEN 呼び出し元がテキスト生成要求（systemPrompt, userPrompt, modelId）を行う THEN WorkersAiClient は Cloudflare Workers AI の `env.AI` バインディング経由でモデルを呼び出す
2. IF モデルID が明示的に指定されない THEN WorkersAiClient は環境変数 `WORKERS_AI_DEFAULT_MODEL` で定義されたデフォルトモデル（例: `@cf/ibm-granite/granite-4.0-h-micro`）を使用する
3. WHEN Workers AI がテキスト応答を返した THEN WorkersAiClient は `Result.ok<TextGenerationResult>` として `{ modelId, text }` を返却する
4. WHEN Workers AI 呼び出しでネットワークエラーまたは HTTP エラーが発生した THEN WorkersAiClient は `Result.err<AppError>` として `ExternalApiError` を返却する
5. WHERE 型安全な JSON 生成が必要なケース THEN WorkersAiClient は `generateJson<T>()` メソッドで応答テキストをパースし、`Result.ok<JsonGenerationResult<T>>` として型安全なオブジェクトを返却する
6. WHEN Workers AI 呼び出しが 10 秒を超過した THEN WorkersAiClient は `TimeoutError` を含む `Result.err` を返却する

### Requirement 2: Tavily Search によるトークン情報検索

**Objective:** システム開発者として、CoinMarketCap などの市場データだけでは得られないトークン固有のナラティブ情報を Web 検索から取得したい。これにより、各トークンの象徴性や背景を反映した絵画生成が可能になる。

#### Acceptance Criteria

1. WHEN トークンメタ情報（`id`, `name`, `symbol`, `chainId`, `contractAddress`）が与えられた THEN TavilyClient は `name + symbol + chainId + "token"` を組み合わせたクエリで Tavily Search API を呼び出す
2. IF Tavily Search が成功した THEN TavilyClient はレスポンスから `title`, `content`, `url` を抽出し、`TavilyArticle[]` として返却する
3. WHEN 抽出した記事を結合したテキストが 6000 文字を超える THEN TavilyClient は上限を超える部分を切り詰めて `combinedText` として返却する
4. IF Tavily Search がネットワークエラー・レートリミット・空レスポンスのいずれかを返した THEN TavilyClient は `Result.err<AppError>` として `ExternalApiError` を返却する
5. WHERE Tavily API 呼び出し THEN TavilyClient は環境変数 `TAVILY_API_KEY` を使用して Bearer 認証を行う
6. WHEN Tavily 呼び出しが 5 秒を超過した THEN TavilyClient は `TimeoutError` を含む `Result.err` を返却する

### Requirement 3: トークンコンテキストの生成とキャッシュ

**Objective:** システム開発者として、トークン固有の短い英語コンテキスト（short_context）を自動生成し、D1 にキャッシュして再利用したい。これにより、Tavily 呼び出しを初回のみに限定し、コストとレイテンシを削減できる。

#### Acceptance Criteria

1. WHEN トークンメタ情報が与えられた THEN TokenContextService は D1 の `token_contexts` テーブルを検索し、既存レコードがあれば `Result.ok<TokenContext>` として返却する
2. IF D1 にレコードが存在しない THEN TokenContextService は TavilyClient でトークン情報を検索し、Workers AI で `short_context`, `category`, `tags` を含む JSON を生成する
3. WHERE Workers AI によるコンテキスト生成 THEN TokenContextService は `generateJson<TokenContextJson>()` を用いて型安全に JSON をパースする
4. WHEN 生成された `short_context` が 50 文字未満または 1000 文字を超える THEN TokenContextService は `Result.err<AppError>` として `ValidationError` を返却する
5. IF Workers AI が JSON 以外の応答を返した THEN TokenContextService は `ParsingError` を含む `Result.err` を返却する
6. WHEN トークンコンテキスト生成が成功した THEN TokenContextService は `{ shortContext, category, tags }` を `Result.ok` として返却する

### Requirement 4: D1 データベースによるキャッシュ管理

**Objective:** システム開発者として、トークンコンテキストを D1 データベースに永続化し、同一トークンに対する重複検索を避けたい。これにより、外部 API 呼び出しコストを削減し、レスポンス速度を向上できる。

#### Acceptance Criteria

1. WHEN TokenContextRepository が `findById(id)` を呼び出す THEN D1 の `token_contexts` テーブルから `token_id` で検索し、該当レコードがあれば `Result.ok<TokenContextRecord>` として返却する
2. IF D1 にレコードが存在しない THEN TokenContextRepository は `Result.ok<null>` を返却する
3. WHERE D1 レコードの `tags` フィールド THEN TokenContextRepository は JSON 文字列を `string[]` にパースして返却する
4. WHEN D1 アクセスでエラーが発生した THEN TokenContextRepository は `Result.err<AppError>` として `DatabaseError` を返却する
5. WHERE `token_contexts` テーブルスキーマ THEN システムは `token_id`, `name`, `symbol`, `chain_id`, `contract_address`, `category`, `tags`, `short_context`, `created_at`, `updated_at` カラムを持つ
6. WHEN `symbol` と `chain_id` で検索する可能性がある THEN システムは `idx_token_contexts_symbol_chain` インデックスを保持する

### Requirement 5: PaintingContext との統合とプロンプト生成

**Objective:** システム開発者として、PaintingContext（市場データと視覚パラメータ）と TokenContext（トークン固有のナラティブ）を統合し、最終的な絵画生成プロンプトを AI で生成したい。これにより、市場状況とトークンの象徴性を反映した一貫性のあるプロンプトを得られる。

#### Acceptance Criteria

1. WHEN WorldPromptService が `composeTokenPrompt()` を呼び出す THEN システムは PaintingContext と TokenContext を受け取り、Workers AI で最終プロンプトを生成する
2. IF TokenContext が提供されない THEN WorldPromptService は TokenContextService を呼び出してトークンコンテキストを取得する
3. WHERE プロンプト生成 THEN WorldPromptService は PaintingContext の視覚パラメータ（climate, archetype, composition, palette など）と TokenContext の `shortContext` を組み合わせたシステムプロンプトを構築する
4. WHEN Workers AI がプロンプトテキストを返した THEN WorldPromptService は `Result.ok<PromptComposition>` として `{ prompt, vp, paramsHash, minuteBucket, seed, filename }` を返却する
5. IF Workers AI 呼び出しが失敗した THEN WorldPromptService は `Result.err<AppError>` を返却する

### Requirement 6: エラーハンドリングとフォールバック

**Objective:** システム開発者として、外部 API 障害時にも絵画生成を継続できるようにしたい。これにより、Tavily や Workers AI の一時的な障害がシステム全体を停止させることを防げる。

#### Acceptance Criteria

1. WHEN Tavily Search が失敗した THEN TokenContextService は `Result.err<AppError>` として `ExternalApiError` を返却する
2. WHEN Workers AI によるトークンコンテキスト生成が失敗した THEN TokenContextService は `Result.err<AppError>` を返却する
3. WHERE 呼び出し元がフォールバックを採用する THEN システムは `FALLBACK_TOKEN_CONTEXT` 定数として汎用的な short_context を提供する
4. IF エラー内容がパース不能応答である THEN システムは `ParsingError` を含む `Result.err` を返却し、リトライではなくフォールバック利用を推奨する
5. WHEN すべてのサービスが `Result` 型でエラーを返す THEN 呼び出し元は `.isErr()` で判定し、適切なフォールバック戦略を選択できる

### Requirement 7: パフォーマンスとタイムアウト制御

**Objective:** システム開発者として、外部 API 呼び出しが長時間ブロックしないようにしたい。これにより、cron ジョブ全体の実行時間を予測可能にし、タイムアウトによるリソース枯渇を防げる。

#### Acceptance Criteria

1. WHEN TavilyClient が Tavily Search を呼び出す THEN システムは 5 秒のタイムアウトを適用する
2. WHEN WorkersAiClient が Workers AI を呼び出す THEN システムは 10 秒のタイムアウトを適用する
3. IF いずれかの外部 API がタイムアウトした THEN クライアントは `Result.err<TimeoutError>` を返却する
4. WHILE cron ジョブが複数回連続で実行されている THEN システムは D1 キャッシュにより Tavily 呼び出しを初回のみに限定する
5. WHEN 同一トークンに対して複数回コンテキスト取得が行われる THEN TokenContextService は D1 キャッシュから即座に返却し、外部 API を呼び出さない

### Requirement 8: セキュリティと環境変数管理

**Objective:** システム開発者として、API キーやモデル設定を安全に管理したい。これにより、機密情報の漏洩を防ぎ、環境ごとに設定を柔軟に変更できる。

#### Acceptance Criteria

1. WHEN TavilyClient が Tavily API を呼び出す THEN システムは環境変数 `TAVILY_API_KEY` を使用して Bearer 認証を行う
2. WHEN WorkersAiClient が Workers AI を呼び出す THEN システムは環境変数 `WORKERS_AI_DEFAULT_MODEL` または呼び出しパラメータからモデル ID を取得する
3. WHERE 機密情報の管理 THEN システムは API キーやモデル ID をコード内にハードコードしない
4. IF 環境変数が未設定であり外部 API を安全に呼び出せない THEN クライアントは `Result.err<ConfigurationError>` を返却する
5. WHEN Cloudflare Workers 環境で実行される THEN システムは `env.AI` バインディングと Secrets から設定を取得する

### Requirement 9: ロギングと可観測性

**Objective:** システム開発者として、トークンコンテキスト生成の成功・失敗を追跡したい。これにより、外部 API の障害やパフォーマンス問題を早期に検知できる。

#### Acceptance Criteria

1. WHEN TokenContextService がトークンコンテキスト生成を開始する THEN システムは `token.id`, `symbol`, `chainId` をログに記録する
2. WHEN TavilyClient が Tavily Search を呼び出す THEN システムは成功・失敗のステータスと記事件数をログに記録する
3. WHEN WorkersAiClient が Workers AI を呼び出す THEN システムは成功・失敗のステータスと使用モデル ID をログに記録する
4. WHEN `Result.err` が呼び出し元へ返却される THEN システムはエラー種別（`type`）とメッセージ（`message`）をログに記録する
5. WHERE 予期しない例外が発生した THEN システムはスタックトレースを含むエラーログを記録する
6. WHEN D1 キャッシュヒットが発生した THEN TokenContextService は `token-context-service.d1-cache-hit` をログに記録する
