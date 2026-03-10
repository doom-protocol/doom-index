# Requirements Document

## Introduction

dynamic-draw は CoinGecko Trending Search からユーザー検索ベースのトレンドトークンを取得し、または管理者が環境変数で指定したトークンリストから主役トークンを自動選定し、市場データと型安全な分類ロジックを組み合わせて PaintingContext を構築し、dynamic-prompt サービス経由で Runware FLUX kontext に画像生成を依頼する 1 時間ごとのバックエンドパイプラインである。

本機能は以下の 3 つのフェーズから構成される：

1. **データ取得フェーズ** - CoinGecko Trending Search から候補トークンリストを取得（または管理者指定のトークンリストを使用）し、主役トークンの市場データ、グローバル市場データ、トークンロゴ画像を取得
2. **コンテキスト構築フェーズ** - TypeScript の分類関数で PaintingContext の 10 要素（主役トークン情報、Market Climate、Token Archetype、Event Pressure、Composition、Palette、Dynamics、Motifs、Narrative Hints、参照画像）を決定
3. **生成・永続化フェーズ** - dynamic-prompt で最終プロンプトを生成し、Runware FLUX kontext で画像生成、結果を D1 に保存

CoinGecko Trending Search によるユーザー検索ベースのトレンド検出と、管理者による柔軟なトークン指定により、「今もっとも話題になれそうなトークン」を選定できる。毎時の自律実行と履歴管理により、アートアーカイブへ継続的に新作を供給しつつ、後続の UI/OGP で再利用できる信頼できるメタデータを提供することが本機能のビジネス価値である。

## Requirements

### Requirement 1A: CoinGecko Trending Search Intake

**Objective:** As a system developer, I want CoinGecko の Trending Search List からユーザー検索ベースのトレンドトークンを取得したい。これにより、実際にユーザーが今興味を持っているトークンを反映できる。

#### Acceptance Criteria

1. WHEN Cloudflare Cron が毎時トリガされた THEN Trending Intake Service SHALL CoinGecko `/search/trending` API（Trending Search List）を呼び出し、`coins` 配列から最大 15 件のトークンを取得する
2. WHERE CoinGecko Trending Search response THEN Trending Intake Service SHALL 各 `coins[i].item` から CoinGecko 内部 ID（`id` フィールド）を抽出する
3. WHEN CoinGecko 内部 ID が取得できた THEN Trending Intake Service SHALL 各トークンに `source: "coingecko-trending-search"` フラグと `trendingRankCgSearch: number` を付与する
4. WHEN CoinGecko Trending Search データが取得できた THEN Trending Intake Service SHALL CoinGecko ID のリスト `[{ id: string, trendingRank: number }]` を返却する
5. IF CoinGecko API がネットワークエラーまたはレートリミットを返した THEN Trending Intake Service SHALL 最大 3 回の指数バックオフリトライを実行し、それでも失敗した場合は `Result.err<AppError>` を返却する

### Requirement 1B: 管理者による候補トークンリストの強制上書き

**Objective:** As a system administrator, I want 環境変数経由でトークンリストを強制的に上書きしたい。これにより、重要なトレンドを逃さず、緊急時に特定のトークンを優先的に選定できる。

#### Acceptance Criteria

1. WHEN Cloudflare Cron が毎時トリガされた THEN Token Selection Service SHALL 環境変数 `FORCE_TOKEN_LIST` の存在を確認する
2. IF 環境変数 `FORCE_TOKEN_LIST` が設定されている THEN Token Selection Service SHALL その値をカンマ区切りの文字列としてパースする
3. WHERE `FORCE_TOKEN_LIST` フォーマット THEN Token Selection Service SHALL 以下の形式を期待する
   - カンマ区切りのティッカーまたは CoinGecko ID 文字列: `"BTC,ETH,SOL"` または `"bitcoin,ethereum,solana"`
   - 各ティッカーは大文字小文字を区別せず、前後の空白をトリムする
4. WHEN `FORCE_TOKEN_LIST` がパースできた THEN Token Selection Service SHALL CoinGecko `/coins/list` API を呼び出し、全トークンの ID マッピング（`id`, `symbol`, `name`）を取得する
5. WHERE 各ティッカーの解決 THEN Token Selection Service SHALL `/coins/list` レスポンスから `symbol` または `id` でマッチングし、対応する CoinGecko ID を取得する
6. IF ティッカーが `/coins/list` で見つからない THEN Token Selection Service SHALL そのティッカーを CoinGecko ID として直接使用する
7. WHEN 各ティッカーの CoinGecko ID が解決できた THEN Token Selection Service SHALL CoinGecko API からのトレンドデータ取得をスキップし、強制リストを候補集合として使用する
8. WHERE 強制リストの各トークン THEN Token Selection Service SHALL `source: "force-override"` フラグと `forcePriority: number`（リスト内の順序、0 から開始）を付与する
9. IF 強制リスト内のティッカーが CoinGecko で解決できない THEN Token Selection Service SHALL 警告ログを記録し、そのティッカーをスキップして次のティッカーへ進む
10. WHEN 強制リストが使用された THEN Token Selection Service SHALL 監査ログに `FORCE_TOKEN_LIST` が使用されたことと、解決されたトークンリスト（ID, symbol, priority）を記録する
11. IF `FORCE_TOKEN_LIST` が空文字列または未設定である THEN Token Selection Service SHALL 通常のトレンドソースからの取得を実行する
12. IF 強制リストのすべてのティッカーが解決できなかった THEN Token Selection Service SHALL エラーログを記録し、通常のトレンドソースからの取得にフォールバックする

### Requirement 1C: CoinGecko ID から詳細トークンデータの取得

**Objective:** As a system developer, I want CoinGecko ID から各トークンの詳細データ（メタデータと市場データ）を取得したい。これにより、トークンの基本情報、ロゴ画像、市場データを統一的に取得できる。

#### Acceptance Criteria

1. WHEN CoinGecko ID のリストが取得できた THEN Token Data Service SHALL 各 ID に対して CoinGecko `/coins/{id}` API を呼び出す
2. WHERE `/coins/{id}` API リクエスト THEN Token Data Service SHALL 以下のクエリパラメータを指定する
   - `localization=false` - ローカライゼーションデータを除外
   - `tickers=false` - ティッカーデータを除外
   - `market_data=true` - 市場データを含める
   - `community_data=false` - コミュニティデータを除外
   - `developer_data=false` - 開発者データを除外
   - `sparkline=false` - スパークラインデータを除外
3. WHERE `/coins/{id}` レスポンス THEN Token Data Service SHALL 以下のフィールドを抽出する
   - `id` - CoinGecko 内部 ID
   - `symbol` - トークンシンボル
   - `name` - トークン名
   - `image.large` または `image.small` - ロゴ画像 URL（Runware 参照画像用）
   - `market_data.current_price.usd` - 現在価格（USD）
   - `market_data.price_change_percentage_24h` - 24h 価格変動率
   - `market_data.price_change_percentage_7d` - 7d 価格変動率
   - `market_data.total_volume.usd` - 24h 取引高（USD）
   - `market_data.market_cap.usd` - 時価総額（USD）
   - `categories` - トークンカテゴリ配列
4. WHEN トークン詳細データが取得できた THEN Token Data Service SHALL 各トークンを候補型 `{ id, symbol, name, logoUrl, priceUsd, priceChange24h, priceChange7d, volume24hUsd, marketCapUsd, categories }` にマッピングして返却する
5. IF `/coins/{id}` API 呼び出しが失敗した THEN Token Data Service SHALL そのトークンをスキップし、警告ログを記録して次のトークンへ進む
6. IF CoinGecko API がレートリミットを返した THEN Token Data Service SHALL 最大 3 回の指数バックオフリトライを実行する
7. WHEN すべてのトークンの詳細データが取得できた THEN Token Data Service SHALL 候補集合 `candidates[]` を返却する

### Requirement 1D: CoinGecko Trending Search からの候補集合の構築とスコアリング

**Objective:** As a system developer, I want CoinGecko Trending Search から取得したトレンド情報をもとに、「今もっとも話題になれそうなトークン」を 1 件選定したい。これにより、生成絵画が実際のユーザー興味と市場の事件性を反映できる。

#### Acceptance Criteria

1. WHEN トークン詳細データが取得できた THEN Token Selection Service SHALL 候補集合 `candidates[]` を構築する
2. WHERE 各 candidate THEN Token Selection Service SHALL 以下のフラグを付与する
   - `fromCoingeckoSearch: boolean`
   - `fromForceOverride: boolean`
   - `trendingRankCgSearch?: number`
   - `forcePriority?: number`
3. IF 強制リスト（`FORCE_TOKEN_LIST`）が使用されている THEN Token Selection Service SHALL ステーブルコイン除外をスキップし、管理者の意図を尊重する
4. IF 強制リストが使用されていない THEN Token Selection Service SHALL ステーブルコイン（USDT, USDC など）を除外リストで除外する
5. IF 強制リストが使用されている THEN Token Selection Service SHALL `forcePriority` に基づいて候補をソートし、最優先トークンを選定する
6. IF 強制リストが使用されていない THEN Token Selection Service SHALL 各 candidate について以下の 3 スコアを算出する
   - `trendScore`（話題性／検索人気）
   - `impactScore`（市場構造的インパクト）
   - `moodScore`（Market Climate との一致度）
7. WHERE `trendScore` THEN Token Selection Service SHALL 次の要素から 0〜1 に正規化されたスコアを計算する
   - CoinGecko Trending Search rank（上位ほど高スコア、重み: 0.60）
   - 24h volume（高いほど加点、重み: 0.40）
8. WHERE `impactScore` THEN Token Selection Service SHALL `|priceChange24h|`, `marketCapUsd`, `volume24hUsd`, `TokenArchetype` から「事件の重さ」を 0〜1 に正規化する
9. WHERE `impactScore` 算出 THEN Token Selection Service SHALL meme / micro-cap は低く、mid/large cap や L1/infra は高くなるようカテゴリ重み付けを行う
10. WHERE `moodScore` THEN Token Selection Service SHALL global `MarketClimate` と candidate の `priceChange24h` の関係から「今の市場ムードに合っているか」（例：panic 中の major collapse、euphoria 中の meme rally など）を 0〜1 スコアとして算出する
11. WHEN `trendScore`, `impactScore`, `moodScore` が算出できた THEN Token Selection Service SHALL 以下の式で `finalScore` を計算する
    - `finalScore = 0.50 * trendScore + 0.35 * impactScore + 0.15 * moodScore`
12. WHERE `finalScore` THEN Token Selection Service SHALL `finalScore` 最大の candidate を主役トークンとして選定し、`{ id, symbol, name, chain, logoUrl, sources, scores: { trend, impact, mood, final } }` を返却する
13. IF `finalScore` がすべての candidate で極端に低い場合（例: 0.1 未満のみ）THEN Token Selection Service SHALL フォールバックとして CoinGecko Trending Search rank 上位のトークンを選定する
14. IF 直近 N run（例: 24 run）で同一トークンが既に選出済みであり、かつ強制リストが使用されていない THEN Token Selection Service SHALL 次点候補へ遷移しスキップ理由と各スコアを監査ログへ記録する
15. IF 強制リストが使用されている THEN Token Selection Service SHALL 重複選出チェックをスキップし、管理者の意図を優先する

### Requirement 2: 主役トークンの市場データ取得（Token Snapshot）

**Objective:** As a system developer, I want 主役トークンの価格変動・出来高・時価総額・ボラティリティを取得したい。これにより、トークンの動きを反映した視覚パラメータを決定できる。

#### Acceptance Criteria

1. WHEN 主役トークンが選定された THEN Market Data Service SHALL Requirement 1C で取得済みの市場データを使用する
2. WHERE Token Snapshot データ THEN Market Data Service SHALL 候補トークンから取得済みの `priceChange24h`, `priceChange7d`, `volume24hUsd`, `marketCapUsd` を抽出する
3. IF ボラティリティスコアが必要である THEN Market Data Service SHALL `|priceChange24h|` と `|priceChange7d|` から簡易ボラティリティスコアを 0〜1 に正規化して計算する
4. WHEN Token Snapshot データが取得できた THEN Market Data Service SHALL `{ p: priceChange24h, p7: priceChange7d, v: volume24hUsd, mc: marketCapUsd, vol: volatilityScore }` を返却する
5. IF 主役トークンの価格または出来高データが欠落している THEN Market Data Service SHALL null フィールドとしてマーキングした上で run を継続する

### Requirement 3: グローバル市場データ取得（Market Snapshot）

**Objective:** As a system developer, I want グローバル暗号通貨市場の状態を取得したい。これにより、Market Climate（市況の天気）を決定できる。

#### Acceptance Criteria

1. WHEN 主役トークン選定プロセスが開始された THEN Market Data Service SHALL CoinGecko `/global` API を呼び出す
2. WHERE CoinGecko `/global` レスポンス THEN Market Data Service SHALL 以下のフィールドを抽出する
   - `data.market_cap_change_percentage_24h_usd` - グローバル時価総額の 24h 変化率（%）
   - `data.market_cap_percentage.btc` - BTC ドミナンス（%）
   - `data.total_market_cap.usd` - グローバル時価総額（USD）
   - `data.total_volume.usd` - グローバル取引高（USD）
3. IF Fear & Greed Index が取得可能である THEN Market Data Service SHALL Alternative.me API から 0〜100 のスコアを取得する
4. IF Fear & Greed Index が取得できない THEN Market Data Service SHALL `fg: null` として返却する
5. WHEN Market Snapshot データが取得できた THEN Market Data Service SHALL `{ mc: globalMcapChange24h, bd: btcDominance, totalMcap: totalMarketCapUsd, totalVolume: totalVolumeUsd, fg: fearGreedIndex | null }` を返却する
6. IF CoinGecko API がネットワークエラーまたはレートリミットを返した THEN Market Data Service SHALL 最大 3 回の指数バックオフリトライを実行する

### Requirement 4: トークンメタ情報の管理と取得

**Objective:** As a system developer, I want トークンのカテゴリ（静的メタデータ）を D1 の `tokens` テーブルで管理したい。これにより、Token Archetype を決定でき、JSON ファイルベースの state 管理を廃止できる。

#### Acceptance Criteria

1. WHEN 主役トークンが選定された THEN Token Repository SHALL `tokens` テーブルから `id` で検索する
2. WHERE トークンメタ情報 THEN Token Repository SHALL `categories` フィールド（JSON 配列文字列、例: `["l1", "perp", "meme"]`）を保持する
3. IF トークンメタ情報が D1 に存在しない THEN Token Repository SHALL デフォルト値（`categories: ["unknown"]`）を返却する
4. WHEN トークンメタ情報が取得できた THEN Token Repository SHALL `categories` を JSON パースして `string[]` として返却する

### Requirement 5: PaintingContext の構築（TypeScript 分類ロジック）

**Objective:** As a system developer, I want 取得したデータから PaintingContext の 10 要素を TypeScript の純粋関数で決定したい。これにより、LLM を呼び出さずに決定論的かつテスト可能な分類を実現できる。

#### Acceptance Criteria

1. WHEN Market Snapshot と Token Snapshot が取得できた THEN Context Builder SHALL `classifyMarketClimate(marketSnapshot)` を呼び出し `MarketClimate` を決定する
2. WHERE Market Climate 分類 THEN Context Builder SHALL 以下のルールを適用する
   - `m.mc > +3 AND fg >= 70` → `"euphoria"`
   - `m.mc > +0.5` → `"cooling"`
   - `m.mc < -5` → `"despair"`
   - `m.mc < -1.5` → `"panic"`
   - それ以外 → `"transition"`
3. WHEN トークンメタ情報が取得できた THEN Context Builder SHALL `classifyTokenArchetype(token, categories)` を呼び出し `TokenArchetype` を決定する
4. WHERE Token Archetype 分類 THEN Context Builder SHALL categories 配列から以下のマッピングを適用する
   - `"perp"` → `"perp-liquidity"`
   - `"meme"` → `"meme-ascendant"`
   - `"l1"` → `"l1-sovereign"`
   - `"privacy"` → `"privacy"`
   - `"ai"` → `"ai-oracle"`
   - `"political"` → `"political"`
   - それ以外 → `"unknown"`
5. WHEN Token Snapshot とトークンメタ情報が取得できた THEN Context Builder SHALL `classifyEventPressure(tokenSnapshot)` を呼び出し `{ k: EventKind, i: EventIntensity }` を決定する
6. WHERE Event Pressure 分類 THEN Context Builder SHALL 以下のルールを適用する
   - `priceChange24h > +10` → `{ k: "rally", i: 3 }`
   - `priceChange24h < -10` → `{ k: "collapse", i: 3 }`
   - `priceChange24h > +5` → `{ k: "rally", i: 2 }`
   - `priceChange24h < -5` → `{ k: "collapse", i: 2 }`
   - それ以外 → `{ k: "ritual", i: 1 }`
7. WHEN Market Climate, Token Archetype, Event Pressure が決定した THEN Context Builder SHALL `pickComposition(climate, archetype, event)` を呼び出し `Composition` を決定する
8. WHERE Composition 選択 THEN Context Builder SHALL 以下のマッピングを適用する
   - `archetype="perp-liquidity" AND event.k="rally"` → `"citadel-panorama"`
   - `archetype="meme-ascendant" AND event.k="rally"` → `"procession"`
   - `climate="euphoria"` → `"central-altar"`
   - `climate="despair"` → `"storm-battlefield"`
   - それ以外 → `"cosmic-horizon"`
9. WHEN Market Climate と Event Pressure が決定した THEN Context Builder SHALL `pickPalette(climate, event)` を呼び出し `Palette` を決定する
10. WHERE Palette 選択 THEN Context Builder SHALL 以下のマッピングを適用する
    - `climate="euphoria"` → `"solar-gold"`
    - `climate="panic" OR climate="despair"` → `"ashen-blue"`
    - `archetype="meme-ascendant" AND event.k="rally"` → `"infernal-red"`
    - それ以外 → `"ivory-marble"`
11. WHEN Token Snapshot が取得できた THEN Context Builder SHALL `classifyDynamics(tokenSnapshot)` を呼び出し `{ dir: TrendDirection, vol: VolatilityLevel }` を決定する
12. WHERE Dynamics 分類 THEN Context Builder SHALL 以下のルールを適用する
    - `priceChange24h > +3` → `dir: "up"`
    - `priceChange24h < -3` → `dir: "down"`
    - それ以外 → `dir: "flat"`
    - `volatilityScore > 0.66` → `vol: "high"`
    - `volatilityScore > 0.33` → `vol: "medium"`
    - それ以外 → `vol: "low"`
13. WHEN Token Archetype が決定した THEN Context Builder SHALL `deriveMotifs(archetype)` を呼び出し `MotifTag[]` を決定する
14. WHERE Motifs 派生 THEN Context Builder SHALL 以下の静的マッピングを適用する
    - `"perp-liquidity"` → `["temple", "wheel-of-liquidity", "pillar"]`
    - `"meme-ascendant"` → `["crowd", "idol"]`
    - `"privacy"` → `["mask", "graveyard"]`
    - それ以外 → `["unknown"]`
15. WHEN すべての分類が完了した THEN Context Builder SHALL `PaintingContext` を構築し返却する

### Requirement 6: dynamic-prompt によるプロンプト生成

**Objective:** As a system developer, I want PaintingContext と TokenContext を統合した最終プロンプトを生成したい。これにより、市場状況とトークンの象徴性を反映した一貫性のあるプロンプトを得られる。

#### Acceptance Criteria

1. WHEN PaintingContext が構築された THEN Prompt Service SHALL dynamic-prompt の `WorldPromptService.composeTokenPrompt()` を呼び出す
2. WHERE プロンプト生成 THEN Prompt Service SHALL PaintingContext と主役トークンのメタ情報を渡す
3. IF TokenContext が D1 に存在しない THEN WorldPromptService SHALL TokenContextService を呼び出してトークンコンテキストを生成する
4. WHEN WorldPromptService がプロンプトを生成した THEN Prompt Service SHALL `{ prompt: string, vp: VisualParams, paramsHash: string, minuteBucket: number, seed: number, filename: string }` を返却する
5. IF dynamic-prompt 呼び出しが失敗した THEN Prompt Service SHALL `Result.err<AppError>` を返却し、呼び出し元がフォールバック戦略を選択できるようにする

### Requirement 7: Runware FLUX kontext による画像生成

**Objective:** As a system developer, I want 最終プロンプトとトークンロゴ画像を Runware FLUX kontext に渡して画像を生成したい。これにより、トークン固有の視覚要素を含む絵画を得られる。

#### Acceptance Criteria

1. WHEN 主役トークンが選定された THEN Asset Loader SHALL Requirement 1C で取得済みのトークンロゴ画像 URL（`image.large` または `image.small`）を使用する
2. WHERE ロゴ画像 URL THEN Asset Loader SHALL HTTPS URL をサニタイズし、Runware に渡す単一の参照画像として準備する
3. WHEN 最終プロンプトとロゴ画像 URL が準備できた THEN Image Generation Service SHALL Runware API に `{ prompt, refImageUrl, model: "FLUX kontext [dev]" }` を渡して画像生成を依頼する
4. IF Runware ジョブが成功した THEN Image Generation Service SHALL 生成画像の URL またはバイナリ、Runware ジョブ ID、メタデータを取得する
5. IF Runware 呼び出しが失敗した THEN Image Generation Service SHALL 最大 3 回のリトライを実行し、それでも失敗した場合は `Result.err<AppError>` を返却する

### Requirement 8: D1 データベーススキーマ設計

**Objective:** As a system developer, I want トークン情報とグローバル市場スナップショットを D1 の構造化されたテーブルで管理したい。これにより、JSON ファイルベースの state 管理を廃止し、型安全かつクエリ可能なデータ管理を実現できる。

#### Acceptance Criteria

1. WHERE D1 データベーススキーマ THEN システムは以下の2つのテーブルを定義する
2. WHEN `tokens` テーブルを定義する THEN システムは以下のカラムを含む
   - `id: text` - PRIMARY KEY, CoinGecko トークン ID（例: `"bitcoin"`）
   - `symbol: text` - トークンシンボル（例: `"BTC"`）
   - `name: text` - トークン名（例: `"Bitcoin"`）
   - `logoUrl: text | null` - トークンロゴ画像 URL
   - `categories: text` - JSON 配列文字列（例: `["l1", "store-of-value"]`）
   - `createdAt: integer` - Unix epoch 秒
   - `updatedAt: integer` - Unix epoch 秒
3. WHEN `market_snapshots` テーブルを定義する THEN システムは以下のカラムを含む
   - `hourBucket: text` - PRIMARY KEY, 時間バケット（例: `"2025-11-21T15"`）
   - `totalMarketCapUsd: real` - グローバル時価総額（USD）
   - `totalVolumeUsd: real` - グローバル取引高（USD）
   - `marketCapChangePercentage24hUsd: real` - グローバル時価総額の 24h 変化率（%）
   - `btcDominance: real` - BTC ドミナンス（%）
   - `ethDominance: real` - ETH ドミナンス（%）
   - `activeCryptocurrencies: integer` - アクティブな暗号通貨数
   - `markets: integer` - 取引所数
   - `fearGreedIndex: integer | null` - Fear & Greed Index（0〜100、オプション）
   - `updatedAt: integer` - CoinGecko データ更新時刻（Unix epoch 秒）
   - `createdAt: integer` - レコード作成時刻（Unix epoch 秒）
4. WHERE インデックス設計 THEN システムは以下のインデックスを定義する
   - `idx_tokens_symbol` on `tokens(symbol)`
   - `idx_market_snapshots_created_at` on `market_snapshots(createdAt)`

### Requirement 9: トークン情報と市場スナップショットの永続化

**Objective:** As a system developer, I want トークン情報とグローバル市場データを D1 に保存したい。これにより、JSON ファイルベースの state 管理を廃止し、シンプルなデータ管理を実現できる。

#### Acceptance Criteria

1. WHEN 主役トークンが選定された THEN Token Repository SHALL `tokens` テーブルに該当トークンが存在するか確認し、存在しない場合は INSERT する
2. WHEN トークンが選出された THEN Token Repository SHALL `updatedAt` を現在時刻に UPDATE する
3. WHEN グローバル市場データが取得できた THEN Market Snapshot Repository SHALL `market_snapshots` テーブルに以下のデータを INSERT する
   - `hourBucket` - 時間バケット
   - `totalMarketCapUsd` - `data.total_market_cap.usd`
   - `totalVolumeUsd` - `data.total_volume.usd`
   - `marketCapChangePercentage24hUsd` - `data.market_cap_change_percentage_24h_usd`
   - `btcDominance` - `data.market_cap_percentage.btc`
   - `ethDominance` - `data.market_cap_percentage.eth`
   - `activeCryptocurrencies` - `data.active_cryptocurrencies`
   - `markets` - `data.markets`
   - `fearGreedIndex` - Fear & Greed Index（取得できた場合）
   - `updatedAt` - `data.updated_at`
   - `createdAt` - 現在時刻
4. IF 同一 `hourBucket` のスナップショットが既に存在する THEN Market Snapshot Repository SHALL UPDATE で上書きする
5. WHEN D1 への保存が完了した THEN Repository SHALL `Result.ok<void>` を返却する
6. IF D1 への保存が失敗した THEN Repository SHALL `Result.err<AppError>` を返却し、エラー詳細をログに記録する

### Requirement 10: 冪等性とエラーハンドリング

**Objective:** As an operations engineer, I want 同一時間スロットでの重複実行を防ぎ、エラー時にも適切に状態を管理したい。これにより、システムの信頼性と運用性を確保できる。

#### Acceptance Criteria

1. WHEN Cloudflare Cron がトリガされた THEN dynamic-draw Orchestrator SHALL 現在の `hourBucket`（例: `"2025-11-21T15"`）を生成する
2. IF 同一 `hourBucket` の `market_snapshots` レコードが既に存在する THEN dynamic-draw Orchestrator SHALL 下流処理をスキップし重複ログを記録する
3. WHEN CoinGecko API 呼び出しが失敗した THEN Trending Intake Service SHALL エラー種別とメッセージをログに記録し、`Result.err<AppError>` を返却する
4. IF Prompt Service または Runware 呼び出しが全リトライ後も失敗した THEN dynamic-draw Orchestrator SHALL エラーをログに記録し、後続処理を停止する
5. WHERE すべてのサービスが `Result` 型でエラーを返す THEN dynamic-draw Orchestrator SHALL `.isErr()` で判定し、適切なフォールバック戦略を選択できる

### Requirement 11: セキュリティと環境変数管理

**Objective:** As a system developer, I want API キーやシークレットを安全に管理したい。これにより、機密情報の漏洩を防ぎ、環境ごとに設定を柔軟に変更できる。

#### Acceptance Criteria

1. WHEN CoinGecko API を呼び出す THEN Trending Intake Service SHALL 環境変数 `COINGECKO_API_KEY`（Pro API の場合）または API キーなし（Public API の場合）で認証を行う
2. WHEN Runware API を呼び出す THEN Image Generation Service SHALL 環境変数 `RUNWARE_API_KEY` を使用して認証を行う
3. WHEN 管理者がトークンリストを強制上書きする THEN Token Selection Service SHALL 環境変数 `FORCE_TOKEN_LIST` から JSON 配列を読み取る
4. WHERE 機密情報の管理 THEN システムは API キーやシークレットをコード内にハードコードしない
5. IF 環境変数が未設定であり外部 API を安全に呼び出せない THEN サービスは `Result.err<ConfigurationError>` を返却する
6. WHEN Cloudflare Workers 環境で実行される THEN システムは Secrets と Bindings から設定を取得する
7. WHERE `FORCE_TOKEN_LIST` 環境変数 THEN システムは機密情報ではないが、管理者のみが設定できるよう Cloudflare Workers の環境変数として管理する

### Requirement 12: ロギングと可観測性

**Objective:** As an operations engineer, I want 絵画生成パイプラインの各フェーズの成功・失敗を追跡したい。これにより、外部 API の障害やパフォーマンス問題を早期に検知できる。

#### Acceptance Criteria

1. WHEN dynamic-draw Orchestrator が実行を開始する THEN システムは `runId`, `hour`, `timestamp` をログに記録する
2. IF 環境変数 `FORCE_TOKEN_LIST` が設定されている THEN システムは `FORCE_TOKEN_LIST` が使用されたことと、リスト内容（トークン ID と priority）を監査ログに記録する
3. WHEN Trending Intake Service が CoinGecko Trending Search からデータを取得する THEN システムは成功・失敗のステータスと取得件数をログに記録する
4. WHEN 主役トークンが選定された THEN Token Selection Service SHALL `tokenId`, `symbol`, `name`, `chain`, `sources`, `scores: { trend, impact, mood, final }` をログに記録する
5. IF 強制リストから主役トークンが選定された THEN Token Selection Service SHALL `source: "force-override"`, `forcePriority` を追加でログに記録する
6. WHEN Token Selection Service が候補をスキップする THEN システムはスキップ理由（重複選出、除外リスト該当など）と候補の `finalScore` をログに記録する
7. WHEN Market Data Service がデータを取得する THEN システムは成功・失敗のステータスとレスポンス要約をログに記録する
8. WHEN Prompt Service が dynamic-prompt を呼び出す THEN システムは成功・失敗のステータスと使用モデル ID をログに記録する
9. WHEN Image Generation Service が Runware を呼び出す THEN システムは成功・失敗のステータスと Runware ジョブ ID をログに記録する
10. WHEN `Result.err` が返却される THEN システムはエラー種別（`type`）とメッセージ（`message`）をログに記録する
11. WHERE 予期しない例外が発生した THEN システムはスタックトレースを含むエラーログを記録する
