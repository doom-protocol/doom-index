# Weighted Prompt System - 重み付きプロンプト生成システム

## 概要

Doom Indexの画像生成システムは、トークンの時価総額（Market Cap）に基づいて、中世寓意画風の重み付きプロンプトを自動生成します。

## コンセプト

### 絵画テーマ

- **スタイル**: 中世寓意画（Renaissance〜Mannerism、Bosch/Bruegel調）
- **技法**: 厚塗り油彩、明暗法（chiaroscuro）
- **構成**: 単一の広い風景に8要素＋人間（観測者）を同居

### 8つの要素

各トークンは特定の寓意的要素に対応：

| Token    | 寓意的要素         | フレーズ                                          |
| -------- | ------------------ | ------------------------------------------------- |
| CO2      | 有毒な煙霧         | dense toxic smog in the sky                       |
| ICE      | 氷河と冷たい反射   | glittering blue glaciers and cold reflections     |
| FOREST   | 生命力ある森林     | lush emerald forests and living roots             |
| NUKE     | 核の閃光           | blinding nuclear flash on the horizon             |
| MACHINE  | ディストピア的機械 | colossal dystopian machine towers and metal grids |
| PANDEMIC | 生物発光する胞子   | bioluminescent spores and organic clusters        |
| FEAR     | 抑圧的な暗闇       | oppressive darkness with many red eyes            |
| HOPE     | 神聖な光           | radiant golden divine light breaking the clouds   |

### 固定要素

- **人間**: `medieval figures praying, trading, recording the scene` (重み: 1.0)
- **スタイル**: `medieval renaissance allegorical oil painting, Bosch and Bruegel influence, chiaroscuro lighting, thick oil texture, symbolic architecture, detailed human figures, cohesive single landscape`

## 重み付けシステム

### 正規化

```typescript
閾値 = 1,000,000 (1M)
正規化重み = clamp(mc / 1_000_000, 0, 1.50)
最小重み = 0.01 (0は0.01に置換)
最大重み = 1.50
```

### 例

Market Cap値:

```
CO2=1,300,000 → 重み 1.30
ICE=200,000   → 重み 0.20
FOREST=900,000 → 重み 0.90
NUKE=50,000   → 重み 0.05
MACHINE=1,450,000 → 重み 1.45
PANDEMIC=700,000 → 重み 0.70
FEAR=1,100,000 → 重み 1.10
HOPE=400,000  → 重み 0.40
```

## プロンプト形式

### SDXL形式（括弧重み）

```
a grand medieval allegorical oil painting of the world, all forces visible and weighted by real-time power,
(colossal dystopian machine towers and metal grids:1.45),
(dense toxic smog in the sky:1.30),
(oppressive darkness with many red eyes:1.10),
(lush emerald forests and living roots:0.90),
(bioluminescent spores and organic clusters:0.70),
(radiant golden divine light breaking the clouds:0.40),
(glittering blue glaciers and cold reflections:0.20),
(blinding nuclear flash on the horizon:0.05),
(medieval figures praying, trading, recording the scene:1.00),
medieval renaissance allegorical oil painting, Bosch and Bruegel influence, chiaroscuro lighting, thick oil texture, symbolic architecture, detailed human figures, cohesive single landscape
```

**ネガティブプロンプト**:

```
watermark, text, logo, oversaturated colors, low detail hands, extra limbs
```

### Runware形式（構造化ペイロード）

```json
{
  "style": "medieval renaissance allegorical oil painting, Bosch and Bruegel influence, chiaroscuro lighting, thick oil texture, symbolic architecture, detailed human figures, cohesive single landscape",
  "negatives": "watermark, text, logo, oversaturated colors, low detail hands, extra limbs",
  "fragments": [
    { "text": "colossal dystopian machine towers and metal grids", "weight": 1.45 },
    { "text": "dense toxic smog in the sky", "weight": 1.3 },
    { "text": "oppressive darkness with many red eyes", "weight": 1.1 },
    { "text": "lush emerald forests and living roots", "weight": 0.9 },
    { "text": "bioluminescent spores and organic clusters", "weight": 0.7 },
    { "text": "radiant golden divine light breaking the clouds", "weight": 0.4 },
    { "text": "glittering blue glaciers and cold reflections", "weight": 0.2 },
    { "text": "blinding nuclear flash on the horizon", "weight": 0.05 },
    { "text": "medieval figures praying, trading, recording the scene", "weight": 1.0 }
  ],
  "width": 1280,
  "height": 720,
  "steps": 30,
  "cfg": 5.5,
  "seed": 42
}
```

## 使用方法

### TypeScript API

```typescript
import { buildSDXLPrompt, buildGenericPayload, toWeightedFragments } from "@/lib/pure/doom-prompt";
import type { McMap } from "@/constants/token";

const mc: McMap = {
  CO2: 1_300_000,
  ICE: 200_000,
  FOREST: 900_000,
  NUKE: 50_000,
  MACHINE: 1_450_000,
  PANDEMIC: 700_000,
  FEAR: 1_100_000,
  HOPE: 400_000,
};

// SDXL形式プロンプト
const { prompt, negative } = buildSDXLPrompt(mc);

// 汎用ペイロード
const payload = buildGenericPayload(mc, {
  width: 1280,
  height: 720,
  steps: 30,
  cfg: 5.5,
  seed: 42,
});

// 重み付きフラグメント（カスタム処理用）
const fragments = toWeightedFragments(mc);
```

### CLIスクリプト

```bash
# デフォルト（全トークン1M）
bun scripts/generate.ts --provider smart

# カスタムMarket Cap値
bun scripts/generate.ts --mc "CO2=1300000,ICE=200000,FOREST=900000,NUKE=50000,MACHINE=1450000,PANDEMIC=700000,FEAR=1100000,HOPE=400000"

# 特定のモデルを指定
bun scripts/generate.ts --provider smart --model "dall-e-3"

# Runwareモデルを使用
bun scripts/generate.ts --provider runware-sdk --model "civitai:38784@44716"

# カスタムサイズ
bun scripts/generate.ts --w 1024 --h 1024

# すべてのオプション
bun scripts/generate.ts \
  --provider smart \
  --model "dall-e-3" \
  --mc "CO2=1300000,ICE=200000,FOREST=900000,NUKE=50000,MACHINE=1450000,PANDEMIC=700000,FEAR=1100000,HOPE=400000" \
  --w 1280 \
  --h 720 \
  --format webp \
  --output ./output
```

## 実装の特徴

### 1. 常にすべての要素を含む

- 重み0のトークンも最小重み（0.01）で含まれる
- 「見えない＝重みが小さい」という表現

### 2. 重み降順でソート

- 生成の安定性向上
- 重要な要素が先に処理される

### 3. 人間要素は固定

- 重み1.0で固定
- シリーズの「芯」として中世的寓意を維持

### 4. 決定論的生成

- 同じMC値 → 同じプロンプト
- seedによる再現性確保

## 運用ノート

### 推奨設定

- **解像度**: 1280×720 または 1024×1024
- **重み上限**: 1.30〜1.50（それ以上は画面が壊れやすい）
- **最小重み**: 0.01（0は不安定）
- **Seed**: 固定することで「MCが変わった分だけ」画面が変化

### プロバイダー選択

- **Smart Provider**: モデル名から自動選択（推奨）
- **AI SDK**: OpenAIモデル（dall-e-3など）
- **Runware SDK**: CivitAIモデルなど任意のモデル

### テスト

```bash
# 全テスト実行
bun test

# プロンプト生成のみ
bun test tests/lib/pure/doom-prompt.test.ts

# サービス統合テスト
bun test tests/services/prompt.compose.test.ts
```

## 参考

- [Smart Provider Documentation](./smart-provider.md)
- [Image Providers Documentation](./image-providers.md)
- [AI SDK Documentation](https://sdk.vercel.ai/docs/ai-sdk-core/image-generation)
- [Runware Documentation](https://runware.ai/docs/en/image-inference/models)
