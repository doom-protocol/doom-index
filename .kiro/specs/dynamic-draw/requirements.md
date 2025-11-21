# Requirements Document

## Project Description (Input)

dynamic-draw

## Requirements

### 1. 概要

#### 1.1 目的

- CoinMarketCap の 24h トレンド上位トークンから **自動的にトークンを選出し**、
- 選出トークンおよび市場データを基に、
- 既存の「プロンプト生成モジュール」（Chat Completion モデル）を経由してテキストプロンプトを生成し、
- Runware 経由で FLUX kontext [dev] に画像生成を依頼する
- 以上を **1時間ごとに自動実行する**バックエンドフローを実装する。

#### 1.2 スコープ

**今回の実装対象（IN）**：

- CoinMarketCap API からの 24h trending token 取得
- トークン選定ロジック（dynamic token select）
- 市場データの取得・整形（basic market snapshot）
- PaintingContext 相当のコンテキスト構築（7パラメータも含めた最低限の v1）
- 既存「プロンプト生成モジュール」との連携（LLM 呼び出しは 1 回）
- Runware → FLUX kontext [dev] への画像生成リクエスト
- 生成結果の永続化（メタ情報＋画像保存先のパス）

**今回スコープ外（OUT / 別途）**：

- フロントエンド（ページ表示、ギャラリー UI）
- マルチスパン（long/mid/short のシリーズ分割）
- 手動トリガー UI
- トークン背景コンフィグの編集 UI
- 高度なトークン選定アルゴリズム（複数ソース統合）

### 2. 前提・制約

- CoinMarketCap の 24h trending API を利用可能であること（API key、レート制限は設定済みとする）。
- Runware 経由で FLUX kontext [dev] を呼び出すための API key・エンドポイントを環境変数で取得できること。
- Chat Completion モデルを使った 「プロンプト生成モジュール」（以下 PromptService）は既に別モジュールとして存在し、
  - 入力：PaintingContext 相当の型（TS）
  - 出力：prompt: string
    を返すインターフェイスを持つ前提とする。
- LLM の推論回数は 1生成あたり 1 回に制限する。
- 参照画像（主役トークンのロゴ画像）は 1 枚のみ利用する。

### 3. 高レベルアーキテクチャ

1. **Scheduler（1hごと）**
   - Cron / Cloudflare Workers / Queue などで 1時間おきにジョブをキックする。

2. **Token Selection Service**
   - CoinMarketCap trending API から 24h 上位リストを取得
   - フィルタリング・順位・履歴を加味して「今回の主役トークン」を 1 つ選出

3. **Market Data Service**
   - 選出されたトークンについて、必要な市場データを取得（価格、変動率、出来高、時価総額など）
   - Global 市況情報（total mcap など）も取得

4. **Context Builder**
   - 生データ（トークン情報 + 市場情報）から PaintingContext を構築
   - 7パラメータ（climate / archetype / event / composition / palette / dynamics / motifs）を TypeScript 側で決定

5. **PromptService 連携**
   - PaintingContext を PromptService に渡し、テキストプロンプトを 1 回の Chat Completion で生成

6. **Image Generation Service**
   - トークンロゴ画像 URL を取得し、必要に応じてダウンロード
   - Runware の FLUX kontext [dev] に prompt + 参照画像 を投げて画像生成

7. **Persistence**
   - 生成メタ情報（トークンID、時刻、使用した context、prompt、Runware job ID、画像URL/PATH）を DB / KV に保存

### 4. 機能要件

**F1. 1時間ごとの自動トリガー**

- F1-1: システムは 1時間ごとに自動的に画像生成ジョブを起動できること。
- F1-2: タイムゾーンは原則 UTC ベースでよいが、保存時に timestamp（ISO8601）を必ず記録すること。
- F1-3: 同一時間スロットで二重実行された場合、同じ hour 内での重複レコードを避ける仕組み（ロック or idempotency key）を持つこと。

**F2. CoinMarketCap Trending からのトークン取得**

- F2-1: CoinMarketCap の 24h trending API を利用し、少なくとも **上位 N 名前（例: 10 件）**のトークン一覧を取得すること。
- F2-2: 取得する情報（最低限）：
  - token ID（CMC 内部 ID）
  - symbol
  - name
  - chain / platform 情報（あれば）
- F2-3: API key は環境変数から取得し、コード内にハードコードしないこと。
- F2-4: レート制限・一時的エラー時は、適切な backoff + リトライポリシーを持つこと（例: 3回 retry）。

**F3. トークン選定ロジック（dynamic token select）**

- F3-1: 「24h trending 上位 N トークン」から、今回の 主役トークンを 1 つ決定すること。
- F3-2: v1 では簡易ロジックで良いが、以下を満たすこと：
  - 直近の数回（例: 24h / 過去 24 run）で 同じトークンばかり選ばないように、履歴を考慮する。
  - stablecoin（USDT, USDC 等）や明らかなインデックストークンは除外するフィルタを持つ。
- F3-3: 選定ロジックは将来的に差し替え可能なように関数境界を切ること（selectToken(trendingList, history): SelectedToken）。

**F4. 市場データ取得（Market Data Service）**

- F4-1: 選ばれたトークンについて、以下の情報を取得できること（CoinMarketCap または他サービス）：
  - priceChange24h (%)
  - priceChange7d (%)
  - volume24hUsd
  - marketCapUsd
  - volatilityScore（なければ独自計算 or 0〜1 正規化スコア）
- F4-2: Global 市場について、最低限以下を取得：
  - globalMcapChange24h (%)
  - btcDominance (%)
  - fearGreedIndex (0–100) — 取得が難しければ後から差し込めるように nullable 設計にしておく。
- F4-3: API エラー時の挙動：
  - トークンのみのデータが取れた場合は global 市場が null でも PaintingContext を構築可能にする（ただし climate 分類ロジック側で fallback）。
  - 全て取得失敗の場合は今回のジョブをスキップし、エラーをログに記録する。

**F5. PaintingContext 構築（Context Builder）**

- F5-1: TypeScript の型として以下を定義する（簡略版）：

```typescript
export type MarketClimate = "euphoria" | "cooling" | "panic" | "despair" | "transition";

export type TokenArchetype =
  | "l1-sovereign"
  | "rollup-scaling"
  | "privacy"
  | "perp-liquidity"
  | "meme-ascendant"
  | "degen-forge"
  | "institutional"
  | "ai-oracle"
  | "political"
  | "socialfi"
  | "unknown";

export type EventKind = "shock" | "rally" | "collapse" | "emergence" | "conquest" | "ritual" | "rebirth";

export type EventIntensity = 0 | 1 | 2 | 3;

export type Composition =
  | "central-altar"
  | "citadel-panorama"
  | "storm-battlefield"
  | "cosmic-horizon"
  | "forge-interior"
  | "procession"
  | "dual-planes";

export type Palette =
  | "solar-gold"
  | "ashen-blue"
  | "infernal-red"
  | "obsidian-black"
  | "ivory-marble"
  | "neon-azure"
  | "verdant-green";

export type TrendDirection = "up" | "down" | "flat";

export type VolatilityLevel = "low" | "medium" | "high";

export type MotifTag =
  | "temple"
  | "pillar"
  | "bridge"
  | "mask"
  | "furnace"
  | "forge"
  | "crowd"
  | "idol"
  | "courthouse"
  | "throne"
  | "wheel-of-liquidity"
  | "astrolabe"
  | "oracle-tower"
  | "graveyard"
  | "unknown";

export interface PaintingContext {
  t: { n: string; c: string }; // token name / chain
  m: { mc: number; bd: number; fg: number | null }; // market snapshot
  s: { p: number; p7: number; v: number; mc: number; vol: number }; // token snapshot
  c: MarketClimate;
  a: TokenArchetype;
  e: { k: EventKind; i: EventIntensity };
  o: Composition;
  p: Palette;
  d: { dir: TrendDirection; vol: VolatilityLevel };
  f: MotifTag[];
  h: string[]; // narrative hints
}
```

- F5-2: 上記 PaintingContext を生成する純粋関数群を用意し、LLM を呼ぶ前に決定を完了させること。
  - classifyMarketClimate(market) => MarketClimate
  - classifyTokenArchetype(token, tokenMeta) => TokenArchetype
  - classifyEventPressure(tokenSnapshot, tokenMeta) => { k, i }
  - classifyDynamics(tokenSnapshot) => { dir, vol }
  - pickComposition(climate, archetype, event) => Composition
  - pickPalette(climate, archetype, event) => Palette
  - deriveMotifs(archetype) => MotifTag[]
- F5-3: h: string[] の narrativeHints は v1 では簡易で良い：
  - 例: ["pump-fun"], ["official-meme"], ["no-vc"] を静的マッピングで付与する。

**F6. PromptService 連携**

- F6-1: PromptService のインターフェイス例：

```typescript
interface PromptService {
  generatePrompt(ctx: PaintingContext): Promise<string>;
}
```

- F6-2: PromptService 内では、既に定義済の system prompt + Chat Completion モデルを用いて 1回の推論で prompt を生成すること。
- F6-3: このモジュールは今回の実装対象外だが、変わらない前提として generatePrompt のみを呼べばよい。

**F7. Runware / FLUX kontext [dev] 呼び出し**

- F7-1: 画像生成サービス（ImageGenerationService）は以下を入力に持つ：

```typescript
interface ImageGenerationRequest {
  prompt: string;
  refImageUrl: string; // トークンロゴ画像 1枚
}
```

- F7-2: CoinMarketCap 等から取得できるロゴ画像 URL を利用し、
  - 直接 URL を FLUX に渡すか、
  - 一度自前で取得・リサイズ後に渡すかは実装側で判断（ただし要件としては「参照画像1枚を渡せること」）。
- F7-3: Runware API 呼び出し成功時に得られる：
  - 生成画像の URL / バイナリ
  - ジョブ ID / meta
    を取得し、これを Persistence 層へ渡すこと。

**F8. 永続化（Persistence）**

- F8-1: 以下の情報を1レコードとして保存できること：

```typescript
interface GeneratedPaintingRecord {
  id: string;
  createdAt: string; // ISO8601
  tokenSymbol: string;
  tokenName: string;
  chain: string;
  paintingContext: PaintingContext; // JSON でそのまま保存
  prompt: string;
  imageUrl: string; // もしくは storagePath
  runwareJobId: string | null;
  source: "cmc-trending-24h";
}
```

- F8-2: 保存先は DB でも KV でもよいが、後続のフロントエンドから参照できるインターフェイスを用意すること。
- F8-3: 今後の分析のために paintingContext はそのまま保存しておくこと（後からロジック検証を行うため）。

**F9. エラーハンドリング・リトライ**

- F9-1: 各段階（CMC取得、Market Data取得、Prompt生成、Image生成）でエラーが発生した場合、
  - エラー内容をログに記録すること。
- F9-2: CMC / Market Data 取得失敗時は、そのジョブでは生成を中止し、次の時間スロットに任せる（無限リトライはしない）。
- F9-3: PromptService / Runware 側での一時的エラーは、数回までリトライし、それでもダメな場合はエラーとして終わらせる。

### 5. 非機能要件

**N1. パフォーマンス**

- 1 回の 1h ジョブは、数十秒〜数分以内に完了すること（画像生成時間に依存）。
- 同時に複数ジョブが走らないよう、1hスロットあたり 1 ジョブに制限する。

**N2. 可用性・耐障害性**

- CMC API / Runware API が一時的に落ちても、システム全体が死なずに次の時間に再開できる構造であること。
- エラー発生時にはログから原因追跡が可能であること。

**N3. 設定・運用**

- 以下の値は環境変数 or 設定ファイルで変更可能とする：
  - CMC API key
  - Runware API key / endpoint
  - Trending 取得数 N
  - 直近履歴数（同じトークンを避ける期間）
  - 画像生成の解像度 / ステップ数（Runware 側のパラメータ）

**N4. テスト性**

- buildPaintingContext, classifyMarketClimate などの純粋関数は、
  Jest 等でユニットテスト可能な設計にする。
- CMC / Runware API 部分はモックしやすいように、インターフェイス（ポート）で抽象化する。

### 6. 将来拡張を見据えたポイント

- PaintingContext と 7 パラメータは、今後 Long/Mid/Short のシリーズ分解や、別スパン用にそのまま再利用可能。
- Token selection 部分を差し替えることで、複数ソース（CoinGecko/Dexscreener 等）併用にも対応可能。
- PromptService を差し替えることで、より高性能な LLM や別モデルへの移行も容易。
