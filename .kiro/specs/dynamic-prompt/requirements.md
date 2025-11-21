# Requirements Document

## Introduction

DOOM INDEX の自動生成パイプラインにおいて、各トークン固有のナラティブ・性質・象徴性を付与するための dynamic-prompt サブモジュールを実装する。本モジュールは `market-cap`・`prompt`・`image-generation` など既存のサービス群と同じレイヤーの内部サービスとして動作し、主に dynamic-draw フローから呼び出される。

dynamic-prompt は Cloudflare Workers AI に対する汎用的かつ型安全なテキスト生成クライアントと、Tavily Search を用いたトークン情報の検索・要約機能を提供する。既存の DOOM INDEX プロジェクトアーキテクチャ（Next.js + Drizzle ORM + Cloudflare Workers）に準拠し、neverthrow ベースの関数型エラーハンドリングおよびロギングユーティリティ（`utils/logger`）を再利用する。HTTP API エンドポイントは公開せず、cron ジョブなどサーバー側の内部処理からのみ呼び出される。

## Requirements

### Requirement 1: Generic Text Generation Client

dynamic-prompt は Cloudflare Workers AI をラップする汎用的かつ型安全なテキスト生成クライアントを提供する。

#### Acceptance Criteria

1. WHEN 呼び出し元がテキスト生成要求を行う場合 THEN dynamic-prompt は プロンプト文字列・システムメッセージ・モデルID を受け取り Workers AI を呼び出す
2. IF モデルIDが明示的に指定されない場合 THEN dynamic-prompt は環境変数で定義されたデフォルトモデルIDを使用する
3. WHEN Workers AI がテキスト応答を返した場合 THEN dynamic-prompt は neverthrow の Result 型として成功結果を返却する
4. WHEN Workers AI 呼び出しでネットワークエラーまたは HTTP エラーが発生した場合 THEN dynamic-prompt は Result 型のエラーとして呼び出し元に伝播する
5. WHERE 型安全な利用が必要なケースでは THEN dynamic-prompt は JSON Schema 互換の型情報を受け取り、応答テキストをパースして型安全なオブジェクトとして返却する

### Requirement 2: Tavily Search Integration

dynamic-prompt は Tavily Search API を統合してトークンに関する外部情報を取得する。

#### Acceptance Criteria

1. WHEN トークンメタ情報（displayName, symbol, chain）が与えられた場合 THEN dynamic-prompt はそれらを組み合わせたクエリで Tavily Search を呼び出す
2. IF Tavily Search が成功した場合 THEN dynamic-prompt はレスポンスから title, content, url を抽出し単一のテキストブロックとして連結する
3. WHEN 連結したテキストの長さが 6000 文字を超える場合 THEN dynamic-prompt は上限を超える部分を切り詰める
4. IF Tavily Search がネットワークエラー・レートリミット・空レスポンスのいずれかを返した場合 THEN dynamic-prompt は Result 型のエラーとして返却し、呼び出し元でフォールバック処理が可能な状態にする
5. WHERE Tavily API 呼び出しでは THEN dynamic-prompt は環境変数 TAVILY_API_KEY を使用して認証を行う

### Requirement 3: Token Context JSON Generation

dynamic-prompt は Tavily 検索結果と Workers AI を組み合わせてトークンコンテキスト JSON を生成する。

#### Acceptance Criteria

1. WHEN Tavily 検索結果テキストが提供された場合 THEN dynamic-prompt は 汎用テキスト生成クライアントを通じて @cf/ibm-granite/granite-4.0-h-micro などのモデルを呼び出し、トークンコンテキスト JSON を生成する
2. WHERE トークンコンテキスト JSON 生成では THEN dynamic-prompt は `"short_context"`, `"category"`, `"tags"` フィールドを必須とする JSON フォーマットを要求する
3. IF Workers AI が有効な JSON を返却した場合 THEN dynamic-prompt は short_context, category, tags を型安全なオブジェクトとして抽出する
4. WHEN 生成された short_context が空または極端に短い／長い場合 THEN dynamic-prompt は Result 型でエラー状態またはフォールバック利用可能な状態を返却する
5. IF Workers AI が JSON 以外の応答を返した場合 THEN dynamic-prompt はパースエラーとして Result 型のエラーを返却する

### Requirement 4: Integration with dynamic-draw

dynamic-prompt は dynamic-draw の cron 処理から呼び出され、トークン用の short_context を提供する内部サブモジュールとして動作する。

#### Acceptance Criteria

1. WHEN dynamic-draw のジョブが主役トークンを選定した場合 THEN dynamic-prompt はトークンメタ情報を入力として受け取り short_context, category, tags を含むコンテキストオブジェクトを返却する
2. IF Tavily Search または Workers AI が成功し有効なコンテキストが得られた場合 THEN dynamic-prompt は Result.ok としてコンテキストオブジェクトを返却する
3. IF Tavily Search または Workers AI のいずれかが失敗した場合 THEN dynamic-prompt は Result.err としてエラー種別とメッセージを返却する
4. WHERE dynamic-draw 側で D1 キャッシュや HTTP レスポンス生成を行う場合 THEN dynamic-prompt はそれらの永続化や HTTP ステータス制御を担当しない

### Requirement 5: Error Handling & Fallbacks

dynamic-prompt は neverthrow を使用した関数型エラーハンドリングとフォールバックコンテキストを提供する。

#### Acceptance Criteria

1. WHEN Tavily Search が失敗した場合 THEN dynamic-prompt は Result.err としてエラーを返却し、呼び出し元がフォールバックコンテキストを選択できるようにする
2. WHEN Workers AI によるトークンコンテキスト生成が失敗した場合 THEN dynamic-prompt は Result.err としてエラーを返却する
3. WHERE 呼び出し元がフォールバックを採用する場合 THEN dynamic-prompt は `"A speculative crypto token with unclear fundamentals but strong narrative-driven price action.\nSymbolic themes: crowds, flickering candles, unstable altars, and volatile market winds."` を short_context として利用可能な定数として提供する
4. IF エラー内容がリトライ不能（パース不能応答など）である場合 THEN dynamic-prompt はリトライ情報ではなくフォールバック利用を推奨するエラー種別を返却する

### Requirement 6: Performance & Scalability

dynamic-prompt は既存プロジェクトのパフォーマンスパターンに準拠し、cron ジョブ内での利用に耐えうるレイテンシとタイムアウト制御を行う。

#### Acceptance Criteria

1. WHEN Tavily Search を呼び出す場合 THEN dynamic-prompt は 5 秒以内を上限とするタイムアウト設定を適用する
2. WHEN Workers AI のテキスト生成を呼び出す場合 THEN dynamic-prompt は 10 秒以内を上限とするタイムアウト設定を適用する
3. IF いずれかの外部 API がタイムアウトした場合 THEN dynamic-prompt は Result.err としてタイムアウトエラーを返却する
4. WHILE cron ジョブが複数回連続で実行されている間 THEN dynamic-prompt は外部 API 呼び出し回数を必要最小限に保つ設計（例: 1 回のトークンごとに 1 回の Tavily + 1 回の AI 呼び出し）を維持する

### Requirement 7: Security & Configuration

dynamic-prompt は既存プロジェクトのセキュリティパターンに準拠し、API キーおよびモデル設定を環境変数から取得する。

#### Acceptance Criteria

1. WHEN Tavily API を呼び出す場合 THEN dynamic-prompt は TAVILY_API_KEY を Cloudflare Workers の環境変数から取得する
2. WHEN Workers AI を呼び出す場合 THEN dynamic-prompt は使用するモデルIDを環境変数または呼び出しパラメータから取得する
3. WHERE 機密情報の管理では THEN dynamic-prompt は API キーやモデルIDをコード内にハードコードしない
4. IF 環境変数が未設定であり外部 API を安全に呼び出せない場合 THEN dynamic-prompt は即座に Result.err として構成エラーを返却する

### Requirement 8: Logging & Observability

dynamic-prompt は既存のロギング・監視方針に従い、主要イベントとエラーを記録可能にする。

#### Acceptance Criteria

1. WHEN トークンコンテキスト生成リクエストが受信された場合 THEN dynamic-prompt は token.id, symbol, chain をロガーに記録する
2. WHEN Tavily Search を呼び出した場合 THEN dynamic-prompt は成功・失敗のステータスとレスポンス要約をロガーに記録する
3. WHEN Workers AI を呼び出した場合 THEN dynamic-prompt は成功・失敗のステータスと使用モデルIDをロガーに記録する
4. WHEN Result.err が呼び出し元へ返却される場合 THEN dynamic-prompt はエラー種別とメッセージをロガーに記録する
5. WHERE 予期しない例外が発生した場合 THEN dynamic-prompt はスタックトレースを含むエラーログをロガーに記録する
