# データ取得から画像生成までの流れ

このドキュメントでは、DOOM INDEX プロジェクトにおけるデータ取得から画像生成までの全体的なフローを整理します。

## 概要

現在のシステムは **dynamic-draw** アーキテクチャに基づいており、以下の特徴があります：

- **動的トークン選択**: CoinGeckoからトレンドトークンを取得し、スコアリングして選択
- **動的プロンプト生成**: Workers AIを使用してトークンコンテキストに基づいたプロンプトを生成
- **市場データベース化**: 市場データとトークンメタデータをD1データベースに保存

## データフロー図

### 全体フロー

```mermaid
flowchart TD
    Start([開始]) --> Step1[Step 1: Token Selection]
    Step1 --> Step2[Step 2: Market Data Fetching]
    Step2 --> Step3[Step 3: Painting Context Building]
    Step3 --> Step4[Step 4: Token Context Generation]
    Step4 --> Step5[Step 5: Prompt Generation]
    Step5 --> Step6[Step 6: Image Generation]
    Step6 --> Step7[Step 7: Storage]
    Step7 --> End([完了])
    
    Step1 --> DB1[(tokens<br/>テーブル)]
    Step2 --> DB2[(market_snapshots<br/>テーブル)]
    Step4 --> DB1
    Step7 --> R2[(R2 Storage)]
    Step7 --> DB3[(paintings<br/>テーブル)]
    
    style Start fill:#e1f5ff
    style End fill:#c8e6c9
    style Step1 fill:#fff3e0
    style Step2 fill:#fff3e0
    style Step3 fill:#fff3e0
    style Step4 fill:#f3e5f5
    style Step5 fill:#fff3e0
    style Step6 fill:#fff3e0
    style Step7 fill:#fff3e0
    style DB1 fill:#e8f5e9
    style DB2 fill:#e8f5e9
    style DB3 fill:#e8f5e9
    style R2 fill:#e8f5e9
```

### 詳細フロー

```mermaid
flowchart TD
    subgraph Step1["Step 1: Token Selection"]
        CG1[CoinGecko API<br/>トレンドトークン取得] --> Score[スコアリング<br/>trend/impact/mood]
        Score --> Filter[フィルタリング<br/>安定コイン除外<br/>最近選択除外]
        Filter --> Select[SelectedToken生成]
        Select --> Save1[tokensテーブル保存]
    end
    
    subgraph Step2["Step 2: Market Data Fetching"]
        CG2[CoinGecko API<br/>グローバル市場データ] --> AltMe[AlternativeMe API<br/>Fear & Greed Index]
        AltMe --> MarketSnap[MarketSnapshot生成]
        MarketSnap --> Save2[market_snapshotsテーブル保存]
    end
    
    subgraph Step3["Step 3: Painting Context Building"]
        Input1[SelectedToken<br/>MarketSnapshot] --> Classify[分類処理]
        Classify --> Climate[MarketClimate]
        Classify --> Archetype[TokenArchetype]
        Classify --> Event[EventPressure]
        Classify --> Comp[Composition]
        Classify --> Palette[Palette]
        Classify --> Dynamics[Dynamics]
        Climate --> Context[PaintingContext生成]
        Archetype --> Context
        Event --> Context
        Comp --> Context
        Palette --> Context
        Dynamics --> Context
    end
    
    subgraph Step4["Step 4: Token Context Generation (Optional)"]
        Tavily[Tavily API<br/>トークン情報検索] --> WorkersAI1[Workers AI<br/>JSON生成]
        WorkersAI1 --> Validate[品質チェック<br/>shortContext: 50-500文字]
        Validate --> TokenCtx[TokenContext生成]
        Validate --> Save3[tokensテーブル<br/>shortContext保存]
    end
    
    subgraph Step5["Step 5: Prompt Generation"]
        Input2[PaintingContext<br/>TokenContext] --> VisualParams[VisualParams生成<br/>デフォルト値]
        VisualParams --> Hash[paramsHash/seed<br/>filename生成]
        Hash --> WorkersAI2[Workers AI<br/>FLUX最適化プロンプト]
        WorkersAI2 --> PromptComp[PromptComposition生成]
    end
    
    subgraph Step6["Step 6: Image Generation"]
        PromptComp --> ImageProvider[ImageProvider<br/>Runware/DALL-E/etc.]
        ImageProvider --> ImageBuffer[ImageBuffer生成]
    end
    
    subgraph Step7["Step 7: Storage"]
        ImageBuffer --> R2Save[R2 Storage<br/>画像保存]
        ImageBuffer --> D1Save[D1 Database<br/>メタデータ保存]
    end
    
    Step1 --> Step2
    Step2 --> Step3
    Step3 --> Step4
    Step4 --> Step5
    Step5 --> Step6
    Step6 --> Step7
    
    style Step1 fill:#fff3e0
    style Step2 fill:#fff3e0
    style Step3 fill:#fff3e0
    style Step4 fill:#f3e5f5
    style Step5 fill:#fff3e0
    style Step6 fill:#fff3e0
    style Step7 fill:#fff3e0
```

### サービス間の相互作用

```mermaid
sequenceDiagram
    participant Orchestrator as PaintingGenerationOrchestrator
    participant TokenSel as TokenSelectionService
    participant MarketData as MarketDataService
    participant ContextBuilder as PaintingContextBuilder
    participant TokenCtx as TokenContextService
    participant PromptSvc as WorldPromptService
    participant ImageGen as ImageGenerationService
    participant Storage as PaintingsService
    
    participant CG as CoinGecko API
    participant AltMe as AlternativeMe API
    participant Tavily as Tavily API
    participant WorkersAI as Workers AI
    participant ImageProvider as Image Provider
    
    participant D1 as D1 Database
    participant R2 as R2 Storage
    
    Orchestrator->>TokenSel: selectToken()
    TokenSel->>CG: トレンドトークン取得
    CG-->>TokenSel: TokenCandidate[]
    TokenSel->>TokenSel: スコアリング・フィルタリング
    TokenSel->>D1: tokensテーブル保存
    TokenSel-->>Orchestrator: SelectedToken
    
    Orchestrator->>MarketData: fetchGlobalMarketData()
    MarketData->>CG: グローバル市場データ取得
    CG-->>MarketData: GlobalMarketData
    MarketData->>AltMe: Fear & Greed Index取得
    AltMe-->>MarketData: FearGreedIndex
    MarketData->>D1: market_snapshotsテーブル保存
    MarketData-->>Orchestrator: MarketSnapshot
    
    Orchestrator->>ContextBuilder: buildContext()
    ContextBuilder->>D1: tokensテーブルから取得
    D1-->>ContextBuilder: TokenMetadata
    ContextBuilder->>ContextBuilder: 分類処理
    ContextBuilder-->>Orchestrator: PaintingContext
    
    Orchestrator->>TokenCtx: generateTokenContext()
    TokenCtx->>Tavily: トークン情報検索
    Tavily-->>TokenCtx: SearchResults
    TokenCtx->>WorkersAI: JSON生成
    WorkersAI-->>TokenCtx: TokenContextJson
    TokenCtx->>D1: tokensテーブルにshortContext保存
    TokenCtx-->>Orchestrator: TokenContext
    
    Orchestrator->>PromptSvc: composeTokenPrompt()
    PromptSvc->>PromptSvc: VisualParams/paramsHash/seed生成
    PromptSvc->>WorkersAI: FLUX最適化プロンプト生成
    WorkersAI-->>PromptSvc: PromptText
    PromptSvc-->>Orchestrator: PromptComposition
    
    Orchestrator->>ImageGen: generateTokenImage()
    ImageGen->>ImageProvider: 画像生成リクエスト
    ImageProvider-->>ImageGen: ImageBuffer
    ImageGen-->>Orchestrator: ImageGenerationResult
    
    Orchestrator->>Storage: storeImageWithMetadata()
    Storage->>R2: 画像保存
    R2-->>Storage: ImageURL
    Storage->>D1: paintingsテーブル保存
    Storage-->>Orchestrator: StorageResult
```

### データフロー

```mermaid
flowchart LR
    subgraph External["外部API"]
        CG[CoinGecko API]
        AM[AlternativeMe API]
        TV[Tavily API]
        WA[Workers AI]
        IP[Image Provider]
    end
    
    subgraph Services["サービス層"]
        TS[TokenSelectionService]
        MD[MarketDataService]
        PCB[PaintingContextBuilder]
        TCS[TokenContextService]
        WPS[WorldPromptService]
        IGS[ImageGenerationService]
    end
    
    subgraph Data["データ"]
        ST[SelectedToken]
        MS[MarketSnapshot]
        PC[PaintingContext]
        TC[TokenContext]
        Prompt[PromptComposition]
        Image[ImageBuffer]
    end
    
    subgraph Storage["ストレージ"]
        D1[(D1 Database)]
        R2[(R2 Storage)]
    end
    
    CG --> TS
    CG --> MD
    AM --> MD
    TV --> TCS
    WA --> TCS
    WA --> WPS
    IP --> IGS
    
    TS --> ST
    MD --> MS
    ST --> PCB
    MS --> PCB
    PCB --> PC
    ST --> TCS
    TCS --> TC
    PC --> WPS
    TC --> WPS
    WPS --> Prompt
    Prompt --> IGS
    IGS --> Image
    
    TS --> D1
    MD --> D1
    TCS --> D1
    Image --> R2
    Image --> D1
    
    style External fill:#e3f2fd
    style Services fill:#fff3e0
    style Data fill:#f3e5f5
    style Storage fill:#e8f5e9
```

## 各ステップの詳細

### Step 1: Token Selection

**サービス**: `TokenSelectionService`

**データ取得**:
- CoinGecko API: トレンドトークンリスト取得
- 市場データ: スコアリング用の市場気候分類

**処理**:
1. CoinGeckoからトレンドトークンを取得
2. スコアリングエンジンで評価:
   - `trendScore`: 価格変動トレンド
   - `impactScore`: 市場インパクト
   - `moodScore`: 市場気候との適合度
3. フィルタリング:
   - 安定コイン除外
   - 最近選択されたトークン除外（24時間以内）
4. 最高スコアのトークンを選択

**出力**: `SelectedToken`
```typescript
{
  id: string;              // CoinGecko ID
  symbol: string;
  name: string;
  logoUrl: string;
  priceUsd: number;
  priceChange24h: number;
  priceChange7d: number;
  volume24hUsd: number;
  marketCapUsd: number;
  categories: string[];
  source: string;
  scores: { trend, impact, mood, final };
}
```

**データベース保存**: `tokens`テーブルにメタデータ保存

---

### Step 2: Market Data Fetching

**サービス**: `MarketDataService`

**データ取得**:
- CoinGecko API: グローバル市場データ
- AlternativeMe API: Fear & Greed Index

**処理**:
1. CoinGeckoからグローバル市場データ取得
2. AlternativeMeからFear & Greed Index取得（オプション）
3. MarketSnapshot生成

**出力**: `MarketSnapshot`
```typescript
{
  totalMarketCapUsd: number;
  totalVolumeUsd: number;
  marketCapChangePercentage24hUsd: number;
  btcDominance: number;
  ethDominance: number;
  activeCryptocurrencies: number;
  markets: number;
  fearGreedIndex: number | null;
  updatedAt: number;
}
```

**データベース保存**: `market_snapshots`テーブルに保存（hourBucket単位）

---

### Step 3: Painting Context Building

**サービス**: `PaintingContextBuilder`

**入力**:
- `SelectedToken`
- `MarketSnapshot`

**処理**:
1. トークンメタデータ取得（`tokens`テーブルから）
2. ボラティリティスコア計算
3. 分類処理:
   - **MarketClimate**: 市場気候分類（euphoria/cooling/despair/panic/transition）
   - **TokenArchetype**: トークンアーキタイプ分類（perp-liquidity/meme-ascendant/l1-sovereign/etc.）
   - **EventPressure**: イベント圧力分類（rally/collapse/ritual + intensity）
   - **Composition**: 構図選択（citadel-panorama/procession/central-altar/etc.）
   - **Palette**: パレット選択（solar-gold/ashen-blue/infernal-red/ivory-marble）
   - **Dynamics**: トレンド方向とボラティリティレベル
   - **Motifs**: モチーフタグ（pump-fun/official-meme/no-vc/etc.）
   - **NarrativeHints**: ナラティブヒント

**出力**: `PaintingContext`
```typescript
{
  t: { n: string; c: string };                    // token name, chain
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

---

### Step 4: Token Context Generation (Optional)

**サービス**: `TokenContextService`

**データ取得**:
- Tavily API: トークン情報検索
- Workers AI: JSON生成

**処理**:
1. Tavilyでトークン情報を検索
2. Workers AIでJSON生成:
   - `shortContext`: 2-4文の英語説明（50-500文字）
   - `category`: カテゴリ（meme/defi/nft/etc.）
   - `tags`: タグ配列（2-5個）
3. 品質チェック（shortContextの長さ）
4. `tokens`テーブルに`shortContext`保存

**出力**: `TokenContext`
```typescript
{
  category: string;
  tags: string[];
}
```

**注意**: `shortContext`は`tokens`テーブルに保存されるが、`TokenContext`型には含まれない

**フォールバック**: 生成失敗時は`FALLBACK_TOKEN_CONTEXT`を使用

---

### Step 5: Prompt Generation

**サービス**: `WorldPromptService`

**入力**:
- `PaintingContext`
- `TokenContext` (オプション)
- `TokenMetaInput` (TokenContext未提供時)

**処理**:
1. VisualParams生成（現在はデフォルト値）
2. paramsHash, seed, filename生成
3. Workers AIでFLUX最適化プロンプト生成:
   - System Prompt: FLUX最適化のガイドライン
   - User Prompt: PaintingContext + TokenContext + VisualParams
4. プロンプトテキストにparamsHashとseedを追加

**出力**: `PromptComposition`
```typescript
{
  seed: string;
  minuteBucket: string;
  vp: VisualParams;
  prompt: {
    text: string;
    negative: string;
    size: { w: number; h: number };
    format: "webp";
    seed: string;
    filename: string;
  };
  paramsHash: string;
}
```

---

### Step 6: Image Generation

**サービス**: `ImageGenerationService`

**入力**:
- `PromptComposition`
- `referenceImageUrl` (トークンロゴURL、オプション)

**処理**:
1. プロンプト詳細ログ出力
2. ImageProviderにリクエスト:
   - prompt: 生成されたプロンプトテキスト
   - negative: ネガティブプロンプト
   - width, height: 画像サイズ（デフォルト: 1024x1024）
   - format: webp
   - seed: シード値
   - referenceImageUrl: トークンロゴURL（オプション）

**出力**: `ImageGenerationResult`
```typescript
{
  composition: PromptComposition;
  imageBuffer: ArrayBuffer;
  providerMeta: Record<string, unknown>;
}
```

---

### Step 7: Storage

**サービス**: `PaintingsService`

**処理**:
1. R2に画像保存: `images/YYYY/MM/DD/DOOM_{timestamp}_{paramsHash}_{seed}.webp`
2. D1にメタデータ保存: `paintings`テーブル
   - id, timestamp, minuteBucket
   - paramsHash, seed
   - r2Key, imageUrl, fileSize
   - visualParamsJson
   - prompt, negative

**完了**: 画像生成パイプライン完了

---

## 必要なデータ

### 外部API依存関係

```mermaid
graph TB
    subgraph Required["必須API"]
        CG[CoinGecko API<br/>必須]
        WA[Workers AI<br/>必須]
        IP[Image Provider<br/>必須<br/>Runware/DALL-E/etc.]
    end
    
    subgraph Optional["オプションAPI"]
        AM[AlternativeMe API<br/>オプション<br/>Fear & Greed Index]
        TV[Tavily API<br/>オプション<br/>TokenContext生成]
    end
    
    subgraph Services["サービス"]
        TS[TokenSelectionService]
        MD[MarketDataService]
        TCS[TokenContextService]
        WPS[WorldPromptService]
        IGS[ImageGenerationService]
    end
    
    CG --> TS
    CG --> MD
    AM -.-> MD
    TV -.-> TCS
    WA --> TCS
    WA --> WPS
    IP --> IGS
    
    style Required fill:#c8e6c9
    style Optional fill:#fff9c4
    style Services fill:#fff3e0
```

### 外部APIから取得するデータ

1. **CoinGecko API** (必須)
   - トレンドトークンリスト
   - トークン詳細（価格、ボリューム、時価総額など）
   - グローバル市場データ

2. **AlternativeMe API** (オプション)
   - Fear & Greed Index

3. **Tavily API** (オプション)
   - トークン情報検索結果

4. **Workers AI** (必須)
   - トークンコンテキスト生成（JSON）
   - プロンプト生成（テキスト）

5. **Image Provider** (必須)
   - Runware/DALL-E/etc.
   - 画像生成

### データベース保存構造

```mermaid
erDiagram
    tokens ||--o{ paintings : "references"
    market_snapshots ||--o{ paintings : "hourBucket"
    
    tokens {
        string id PK
        string symbol
        string name
        string logoUrl
        string categories
        string shortContext
        int createdAt
        int updatedAt
    }
    
    market_snapshots {
        string hourBucket PK
        number totalMarketCapUsd
        number marketCapChangePercentage24hUsd
        number fearGreedIndex
        int createdAt
    }
    
    paintings {
        string id PK
        string timestamp
        string minuteBucket
        string paramsHash
        string seed
        string r2Key
        string imageUrl
        int fileSize
        string visualParamsJson
        string prompt
        string negative
    }
```

### データベースに保存するデータ

1. **tokensテーブル**
   - トークンメタデータ（id, symbol, name, logoUrl, categories）
   - `shortContext`（TokenContextServiceで生成）

2. **market_snapshotsテーブル**
   - 市場スナップショット（hourBucket単位）

3. **paintingsテーブル**
   - 生成された画像のメタデータ
   - プロンプト、パラメータ、R2キーなど

---

## 不要になったデータ

### Legacy 8-Token System

以下のデータは削除されました：

1. **McMap (Market Cap Map)**
   - 8つの固定トークン（CO2, ICE, FEAR, HOPE, FOREST, MACHINE, NUKE, PANDEMIC）の時価総額マップ
   - `normalizeMcMap()`は空のオブジェクトを返す（後方互換性のため）

2. **mcRounded**
   - 時価総額を4桁に丸めた値
   - `paintings`テーブルには`mcRoundedJson`カラムが残っているが、使用されていない

3. **VisualParams from Market Cap**
   - 時価総額マップから生成されるVisualParams
   - 現在はデフォルト値（すべて0）が使用される

4. **Weighted Prompt System**
   - `buildSDXLPrompt()`は非推奨
   - 代わりに`WorldPromptService.composeTokenPrompt()`を使用

### 削除されたファイル

- `src/constants/prompts/doom-painting.ts` - Legacy プロンプト定義
- `src/repositories/token-context-repository.ts` - TokenContextは直接`tokens`テーブルに保存

### 削除されたコンポーネント

- `src/components/archive/archive-camera-rig.tsx`
- `src/components/archive/archive-painting-skeleton.tsx`
- `src/components/archive/archive-paintings-grid.tsx`
- `src/components/archive/archive-scene.tsx`
- `src/components/archive/archive-zoom-view.tsx`

---

## データフローの変更点

### Before vs After 比較

```mermaid
flowchart TB
    subgraph Legacy["Legacy System (Before)"]
        L1[Market Cap Map<br/>8固定トークン] --> L2[VisualParams<br/>時価総額ベース]
        L2 --> L3[Weighted Prompt<br/>静的プロンプト]
        L3 --> L4[Image]
        L1 -.-> L5[R2 State<br/>state/global.json]
    end
    
    subgraph Current["Dynamic-Draw System (After)"]
        C1[Token Selection<br/>CoinGeckoトレンド] --> C2[Market Data<br/>グローバル市場]
        C2 --> C3[Painting Context<br/>分類処理]
        C3 --> C4[Token Context<br/>Tavily + Workers AI]
        C4 --> C5[Dynamic Prompt<br/>Workers AI生成]
        C5 --> C6[Image]
        C1 -.-> C7[D1 Database<br/>tokens/market_snapshots]
        C4 -.-> C7
        C6 -.-> C8[R2 Storage<br/>images/YYYY/MM/DD]
        C6 -.-> C9[D1 Database<br/>paintings]
    end
    
    style Legacy fill:#ffebee
    style Current fill:#e8f5e9
    style L1 fill:#fff3e0
    style L2 fill:#fff3e0
    style L3 fill:#fff3e0
    style L4 fill:#fff3e0
    style L5 fill:#f3e5f5
    style C1 fill:#fff3e0
    style C2 fill:#fff3e0
    style C3 fill:#fff3e0
    style C4 fill:#fff3e0
    style C5 fill:#fff3e0
    style C6 fill:#fff3e0
    style C7 fill:#e8f5e9
    style C8 fill:#e8f5e9
    style C9 fill:#e8f5e9
```

### 主な変更点

1. **固定トークン → 動的トークン選択**
   - 8つの固定トークンから、CoinGeckoのトレンドトークンに変更

2. **時価総額ベースのVisualParams → デフォルト値**
   - 時価総額マップから生成されるVisualParamsは使用されず、デフォルト値（すべて0）が使用される

3. **静的プロンプト → 動的プロンプト生成**
   - Workers AIを使用してトークンコンテキストに基づいたプロンプトを動的に生成

4. **R2 State → D1 Database**
   - アプリケーション状態はR2の`state/`フォルダからD1データベースに移行

---

## 環境変数

### 必須

- `COINGECKO_API_KEY`: CoinGecko APIキー
- `AI`: Cloudflare Workers AIバインディング（本番環境）

### オプション

- `TAVILY_API_KEY`: Tavily APIキー（TokenContext生成用）
- `FORCE_TOKEN_LIST`: 強制トークンリスト（テスト用）
- `IMAGE_MODEL`: 画像生成モデル名

---

## 関連ファイル

### サービス

- `src/services/paintings/token-selection.ts` - トークン選択
- `src/services/paintings/market-data.ts` - 市場データ取得
- `src/services/paintings/painting-context-builder.ts` - コンテキスト構築
- `src/services/token-context-service.ts` - トークンコンテキスト生成
- `src/services/world-prompt-service.ts` - プロンプト生成
- `src/services/image-generation.ts` - 画像生成
- `src/services/paintings/painting-generation-orchestrator.ts` - オーケストレーション

### リポジトリ

- `src/repositories/tokens-repository.ts` - トークンメタデータ
- `src/repositories/market-snapshots-repository.ts` - 市場スナップショット
- `src/repositories/paintings-repository.ts` - 画像メタデータ

### 型定義

- `src/types/paintings.ts` - SelectedToken, MarketSnapshot, etc.
- `src/types/painting-context.ts` - PaintingContext
- `src/services/token-context-service.ts` - TokenContext

### データベーススキーマ

- `src/db/schema/tokens.ts` - tokensテーブル
- `src/db/schema/market-snapshots.ts` - market_snapshotsテーブル
- `src/db/schema/paintings.ts` - paintingsテーブル
