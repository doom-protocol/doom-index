# Implementation Plan - dynamic-prompt

- [x] 1. dynamic-prompt サービスの基盤実装
- [x] 1.1 Workers AI 用テキスト生成クライアントの実装
  - Cloudflare Workers AI のモデルカタログから text generation モデルを選定し、デフォルトモデル ID（例: `@cf/ibm-granite/granite-4.0-h-micro`）を環境変数 `WORKERS_AI_DEFAULT_MODEL` として定義する
  - Cloudflare Workers 環境で `env.AI` バインディング経由で Workers AI を呼び出す実装を行う（参考: [Workers AI docs](https://developers.cloudflare.com/workers-ai/)）
  - `env.AI.run(modelId, { messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] })` 形式でリクエストを送り、レスポンスから `response.text` または `response.response` フィールドを安全に抽出する
  - モデル ID が指定されない場合には、環境変数から取得したデフォルトモデル ID を使用する
  - 成功時は生成テキストを含む Result.ok を返し、HTTP エラーやネットワークエラー時には ExternalApiError 相当の Result.err を返す
  - Workers AI 呼び出しに対して 10 秒のタイムアウト設定を適用し、タイムアウト時には TimeoutError を返す
  - _Requirements: 1, 6, 7, 8_

- [x] 1.2 JSON 生成対応と型安全なパース処理の追加
  - Workers AI の JSON 生成モードを使用するため、systemPrompt に「必ず JSON のみを返し、追加のテキストやマークダウン記法を含めない」という制約を明示する
  - Workers AI の応答を JSON 形式として解釈するためのメソッドを追加し、short_context や category, tags などの構造化データを取得できるようにする
  - JSON Schema 互換の型情報を受け取り、応答テキストを型安全にパースして汎用的な JsonGenerationResult として返却する
  - JSON パースに失敗した場合や必須フィールド欠落時には ParsingError 相当の Result.err を返す
  - パース時の失敗パターン（追加テキスト混入、マークダウン記法の混入、不完全な JSON）をテストケースとして列挙し、それぞれのエラーハンドリングを実装する
  - _Requirements: 1, 3, 5, 6, 8_

- [x] 2. Tavily Search 連携の実装
- [x] 2.1 Tavily クライアントの実装
  - Tavily JavaScript SDK `@tavily/core` をインストールし、プロジェクトの依存関係に追加する（参考: [Tavily JS SDK Quickstart](https://docs.tavily.com/sdk/javascript/quick-start)）
  - Cloudflare Workers 環境で `@tavily/core` がバンドル可能か確認し、問題があれば SDK ではなく REST API 直呼び出し（`https://api.tavily.com/search`）に切り替える判断基準を決める
  - 環境変数 `TAVILY_API_KEY` から API キーを読み込み、`tavily({ apiKey: env.TAVILY_API_KEY })` 形式で Tavily クライアントを初期化する
  - トークンメタ情報（id, name, symbol, chainId, contractAddress）から検索クエリ文字列を構築する（例: `"${name} ${symbol} ${chainId} token"`）
  - Tavily の `search` API に対して、クエリ文字列と `max_results`（デフォルト: 5）、`search_depth`（デフォルト: "basic"）などのパラメータを送るリクエストを実装する
  - レスポンスから `results` 配列を取得し、各要素の `title`, `content`（または `snippet`）, `url` を抽出して `TavilyArticle` 型として整理する
  - 抽出した記事情報を「title → content → url」の順で 1 ブロックとし、複数結果を改行で連結して `combinedText` を生成する
  - combinedText が 6000 文字を超える場合には、上限に収まるようにテキストをトリムする
  - Tavily 呼び出しに対して 5 秒のタイムアウト設定を適用し、タイムアウト時には TimeoutError を返す
  - _Requirements: 2, 6, 7, 8_

- [x] 2.2 Tavily エラー時のエラーハンドリングと Result 型伝播
  - Tavily JS SDK 利用時に考えられる例外（SDK レベルのエラー、HTTP ステータスエラー、レスポンスフォーマット変更など）を列挙し、それぞれをどのエラー種別にマッピングするかを決める
  - Tavily API がネットワークエラー・HTTP エラー（4xx/5xx）・レートリミット（429）・空レスポンスを返した場合の判定ロジックを実装する
  - Tavily 側のレートリミットポリシーを確認し、429 や 5xx 返却時のリトライ戦略（何回 / どの間隔 / どの時点で諦めるか）を文章で明確にする（本タスクではリトライは実装せず、エラー返却のみ）
  - これらのケースでは ExternalApiError 相当の Result.err を返し、呼び出し元がフォールバックコンテキストやスキップ処理を選択できるようにする
  - Tavily 呼び出し結果とエラー内容を logger に記録し、監視・デバッグに利用できるようにする
  - _Requirements: 2, 5, 6, 8_

- [x] 3. D1 token_contexts リポジトリの実装
- [x] 3.1 Drizzle スキーマと D1 参照層の実装
  - D1 データベース上の token_contexts テーブルに対応する Drizzle スキーマを作成する
  - カラム名は `token_id`（PRIMARY KEY）, `name`, `symbol`, `chain_id`, `contract_address`, `category`, `tags`, `short_context`, `created_at`, `updated_at` とする
  - Drizzle スキーマのフィールド名は `id`, `name`, `symbol`, `chainId`, `contractAddress`, `category`, `tags`, `shortContext`, `createdAt`, `updatedAt` に統一する
  - `symbol` と `chainId`（DB カラム名: `chain_id`）の組み合わせによる検索を最適化するためのインデックス `idx_token_contexts_symbol_chain` を定義する
  - TokenContextRepository として `findById(id: string)` を実装し、id に対応するレコードを取得できるようにする
  - tags フィールドを JSON.parse して `string[] | null` 型に変換し、TokenContextRecord 型として返す
  - D1 バインディング（`env.DB`）を Drizzle ORM 経由で使用し、既存の `src/db` パターンに準拠する
  - _Requirements: 1, 4, 6, 7_

- [x] 3.2 D1 アクセスエラーと存在しないレコードの扱い
  - D1 アクセス時に接続エラーやクエリエラーが発生した場合に AppError 相当の Result.err を返す処理を実装する
  - 対象トークンのレコードが存在しない場合には `Result.ok(null)` を返し、呼び出し元が Tavily 検索にフォールバックできるようにする
  - D1 へのクエリとエラー内容を logger に記録し、トレーサビリティを確保する
  - _Requirements: 4, 5, 6, 8_

- [x] 4. TokenContext 生成サービスの実装
- [x] 4.1 D1 優先での TokenContext 解決ロジック
  - TokenContextService を実装し、TokenMetaInput（id, name, symbol, chainId, contractAddress, createdAt）から TokenContext を生成するエントリポイントを提供する
  - まず TokenContextRepository を用いて D1 から既存のトークンコンテキストを検索し、レコードが存在する場合にはそれを TokenContext として採用する
  - D1 ヒット時には Tavily を呼び出さずに shortContext, category, tags をそのまま返すようにする
  - D1 ヒット時も D1 ミス時も、最終的に Workers AI でプロンプト生成を行うフローに進む（D1 の shortContext を Workers AI の入力として使用）
  - _Requirements: 3, 4, 6, 7, 8_

- [x] 4.2 D1 ミス時の Tavily + Workers AI による TokenContext 生成
  - D1 にコンテキストが存在しない場合、TavilyClient を呼び出して記事テキスト combinedText を取得する
  - combinedText を WorkersAiClient の JSON 生成メソッドに渡し、short_context, category, tags を持つ JSON を生成する
  - Workers AI の systemPrompt に「トークン情報を short_context（2-4文の英語テキスト）、category（1語）、tags（文字列配列）の JSON 形式で返す」という指示を組み込む
  - Workers AI 応答をパースして TokenContext を構築し、Result.ok として返す処理を実装する
  - Tavily または Workers AI のどちらかが失敗した場合には、適切なエラー種別を持つ Result.err を返す
  - _Requirements: 2, 3, 5, 6, 7, 8_

- [x] 4.3 short_context 品質チェックとフォールバック制御
  - 生成された shortContext の文字数や文数を確認し、極端に短い（50文字未満）または長い（500文字超）場合にエラー扱いまたは警告扱いとするロジックを実装する
  - フォールバック用の固定 short_context テキスト定数 `FALLBACK_TOKEN_CONTEXT` をエクスポートし、呼び出し元が必要に応じて採用できるようにする
  - フォールバック利用を推奨するエラー種別を定義し、呼び出し元が挙動を判断しやすくする
  - _Requirements: 3, 5, 6_

- [x] 5. PromptService の dynamic-prompt ベース実装への置き換え
- [x] 5.1 既存 PromptService とのインターフェイス整合
  - 現在の PromptService が PaintingContext を受け取り weighted-prompt ベースでプロンプトを生成している構造を確認する
  - dynamic-prompt ベースの PromptService で、PaintingContext と TokenContext を入力として Workers AI を用いて最終プロンプトを生成する設計に合わせる
  - 既存の doom-prompt や weighted-prompt のロジックを、Workers AI の systemPrompt / userPrompt 構成に組み込む方針を定義する
  - Workers AI の systemPrompt に「DOOM INDEX 向けの絵画プロンプトを生成する」という指示と、既存のプロンプトスタイルの要件を組み込む
  - _Requirements: 1, 3, 4_

- [x] 5.2 PromptService 実装でのフロー統合
  - cron フローから呼び出される PromptService 内で、TokenContextService を利用してトークンコンテキストを取得する処理を組み込む
  - D1 ヒット時は D1 の shortContext を、ミス時は Tavily + Workers AI で生成された shortContext を用いて Workers AI に最終プロンプト生成を依頼する
  - PaintingContext と TokenContext を統合した userPrompt を構築し、Workers AI の `generateText` メソッドを呼び出す
  - 生成した英語プロンプト文字列を既存の image-generation サービスに渡し、他の部分とのインターフェイスを維持する
  - _Requirements: 1, 3, 4, 6_

- [x] 6. エラーハンドリングとロギングの実装
- [x] 6.1 Result ベースのエラーハンドリング統合
  - WorkersAiClient, TavilyClient, TokenContextRepository, TokenContextService, PromptService の全てで Result 型を用いたエラーハンドリングを統一する
  - ExternalApiError, ConfigurationError, ParsingError, TimeoutError などのエラー種別を定義し、AppError として整理する
  - dynamic-draw 側の cron フローが、Result.err を受け取った際にフォールバックやスキップを選択できるようにする
  - _Requirements: 5, 6, 8_

- [x] 6.2 ロギングと監視ポイントの追加
  - token.id, name, symbol, chainId などのリクエストコンテキストをログに記録する
  - D1 参照結果（ヒット/ミス）、Tavily 呼び出し結果（成功/失敗、記事件数）、Workers AI 呼び出し結果（成功/失敗、使用モデル ID）をそれぞれ info レベルでログに記録する
  - Result.err で返却される全てのエラーについて、エラー種別とメッセージを error レベルで記録し、トレースに利用できるようにする
  - 予期しない例外発生時にはスタックトレースを含むエラーログを記録する
  - _Requirements: 5, 6, 8_

- [x] 7. テスト実装
- [x] 7.1 ユニットテストの実装
  - WorkersAiClient の成功ケース・HTTP エラーケース・JSON パース失敗ケース・タイムアウトケースをテストする
  - TavilyClient について、正常レスポンス・文字数トリム・ネットワークエラー・HTTP エラー・タイムアウトをテストする
  - TokenContextRepository の D1 ヒット・ミス・D1 エラー時の挙動をテストする
  - TokenContextService の D1 ヒットパス・D1 ミス時の Tavily + AI パス・いずれかの失敗時のエラー返却をテストする
  - PromptService の PaintingContext + TokenContext から最終プロンプト生成までのフローをテストする
  - _Requirements: 1, 2, 3, 4, 5, 6_

- [x] 7.2 統合テストと外部 API 実コール検証
  - dynamic-prompt 経由で TokenContext を取得する統合テストを作成し、D1 ヒット・ミスそれぞれのパスでの挙動を検証する
  - 環境変数フラグ（例: `ENABLE_EXTERNAL_API_TESTS=true`）に基づき、Tavily API と Cloudflare Workers AI に対して実際の API コールを行う統合テストを用意する
  - Tavily の実コールテストでは、`@tavily/core` SDK の Quickstart 例をベースに、実在するトークン名（例: "Bitcoin", "Ethereum"）を用いた検索で `search` を呼び、記事リストが 1 件以上返ることと combinedText が空でないことを確認する（参考: [Tavily JS SDK Quickstart](https://docs.tavily.com/sdk/javascript/quick-start)）
  - Workers AI の実コールテストでは、Workers AI ドキュメントの「Get started」例を参考に、固定の systemPrompt / userPrompt で 1 回だけモデルを呼び出し、応答テキストが空でないこと、およびレスポンスタイムがタイムアウト設定（10秒）内に収まることを確認する（参考: [Workers AI docs](https://developers.cloudflare.com/workers-ai/)）
  - JSON 生成モードの実コールテストでは、short_context, category, tags を含む JSON が正しく生成され、パース可能であることを確認する
  - 統合テストでは API キーや機密情報をログに出力しないようにし、レートリミットに配慮してテストケース数と呼び出し頻度を制御する
  - _Requirements: 1, 2, 3, 6, 7, 8_

- [x] 8. パフォーマンス・設定・リファクタリング
- [x] 8.1 タイムアウトと呼び出し回数制御の調整
  - Tavily 呼び出しに対して 5 秒、Workers AI 呼び出しに対して 10 秒のタイムアウト設定が正しく適用されていることを確認する
  - TimeoutError のハンドリングが適切に行われ、ジョブ全体が無限待ちにならないことを検証する
  - 1 トークンあたり Tavily 1 回 + Workers AI 1 回（D1 ミス時）または Workers AI 1 回のみ（D1 ヒット時）に収まるように、フロー全体の呼び出し回数を確認する
  - _Requirements: 2, 3, 6_

- [x] 8.2 環境変数と設定の整理
  - `TAVILY_API_KEY` や `WORKERS_AI_DEFAULT_MODEL`（例: `@cf/ibm-granite/granite-4.0-h-micro`）など、本機能に必要な環境変数を `.example.vars` / `.dev.vars` などの設定例と整合させる
  - Cloudflare Workers の `wrangler.toml` に `[ai]` バインディングが設定されていることを確認し、`env.AI` 経由で Workers AI を呼び出せるようにする
  - 環境変数未設定時に ConfigurationError を返す経路を確認し、開発・本番双方での設定ミスに気付きやすくする
  - _Requirements: 7, 8_
