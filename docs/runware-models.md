# Runware Models Configuration

このドキュメントでは、Runware画像生成モデルの設定と使用方法について説明します。

## 概要

Runwareは2つのモデル形式をサポートしています：

1. **Runware AIR Models**: `runware:aid@version` 形式
2. **Civitai Models**: `civitai:modelId@versionId` 形式

すべてのモデル設定は `src/constants/runware.ts` で一元管理されています。

## 定数の使用

### 基本的な使用方法

```typescript
import {
  RUNWARE_AIR_MODELS,
  CIVITAI_MODELS,
  DEFAULT_RUNWARE_MODEL,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_RUNWARE_TIMEOUT,
} from "@/constants/runware";

// デフォルトモデルを使用
const model = DEFAULT_RUNWARE_MODEL; // "runware:106@1" (FLUX.1 Kontext [dev])

// 事前定義されたモデルを使用
const kontextModel = RUNWARE_AIR_MODELS.DEFAULT.model; // "runware:106@1" (FLUX.1 Kontext [dev])
const schnellModel = RUNWARE_AIR_MODELS.FLUX_SCHNELL.model; // "runware:100@1" (FLUX.1 [schnell])
const civitaiModel = CIVITAI_MODELS.EXAMPLE.model; // "civitai:38784@44716"

// デフォルト設定
const size = DEFAULT_IMAGE_SIZE; // 1024
const timeout = DEFAULT_RUNWARE_TIMEOUT; // 30000 (30秒)
```

### 型ガード関数

```typescript
import { isRunwareAirModel, isCivitaiModel, isRunwareModel } from "@/constants/runware";

const model1 = "runware:100@1";
const model2 = "civitai:38784@44716";
const model3 = "dall-e-3";

isRunwareAirModel(model1); // true
isCivitaiModel(model2); // true
isRunwareModel(model1); // true
isRunwareModel(model2); // true
isRunwareModel(model3); // false
```

## 新しいモデルの追加

### Runware AIR モデルの追加

`src/constants/runware.ts` の `RUNWARE_AIR_MODELS` に追加します：

```typescript
export const RUNWARE_AIR_MODELS = {
  DEFAULT: {
    model: "runware:106@1",
    name: "FLUX.1 Kontext [dev]",
    description: "FLUX.1 Kontext development model with extended context understanding",
  },
  FLUX_SCHNELL: {
    model: "runware:100@1",
    name: "FLUX.1 [schnell]",
    description: "FLUX.1 Schnell model for fast image generation",
  },
  // 新しいモデルを追加
  FLUX_PRO: {
    model: "runware:200@1",
    name: "Flux Pro",
    description: "High-quality flux model",
  },
} as const satisfies Record<string, RunwareAirModel>;
```

### Civitai モデルの追加

`src/constants/runware.ts` の `CIVITAI_MODELS` に追加します：

```typescript
export const CIVITAI_MODELS = {
  EXAMPLE: {
    model: "civitai:38784@44716",
    name: "Civitai Example",
    description: "Example Civitai model",
  },
  // 新しいモデルを追加
  ANIME_STYLE: {
    model: "civitai:12345@67890",
    name: "Anime Style",
    description: "Anime-style image generation model",
  },
} as const satisfies Record<string, CivitaiModel>;
```

## 環境変数での設定

デフォルトモデルは環境変数 `IMAGE_MODEL` で上書きできます：

```bash
# .env または .dev.vars
IMAGE_MODEL=runware:200@1
# または
IMAGE_MODEL=civitai:12345@67890
```

環境変数が設定されていない場合は、`DEFAULT_RUNWARE_MODEL` が使用されます。

## プロバイダーでの使用

Runwareプロバイダーは自動的にこれらの定数を使用します：

```typescript
// src/lib/providers/runware.ts
import { DEFAULT_RUNWARE_MODEL, DEFAULT_IMAGE_SIZE, DEFAULT_RUNWARE_TIMEOUT } from "@/constants/runware";

// モデルが指定されていない場合はデフォルトを使用
const model = input.model || DEFAULT_RUNWARE_MODEL;
const width = DEFAULT_IMAGE_SIZE;
const height = DEFAULT_IMAGE_SIZE;
const timeoutMs = options?.timeoutMs ?? DEFAULT_RUNWARE_TIMEOUT;
```

## スクリプトでの使用例

### generate.ts での使用

```bash
# デフォルトモデルを使用（FLUX.1 Kontext [dev]）
bun scripts/generate.ts

# FLUX.1 [schnell]を使用（高速生成）
bun scripts/generate.ts --model "runware:100@1"

# 特定のRunware AIRモデルを使用
bun scripts/generate.ts --model "runware:200@1"

# Civitaiモデルを使用
bun scripts/generate.ts --model "civitai:38784@44716"
```

### コード内での使用

```typescript
import { RUNWARE_AIR_MODELS } from "@/constants/runware";
import { createImageProvider } from "@/lib/image-generation-providers";

const provider = createImageProvider();

const result = await provider.generate({
  prompt: "A beautiful landscape",
  negative: "blurry, low quality",
  width: 1024,
  height: 1024,
  format: "webp",
  seed: "abc123",
  model: RUNWARE_AIR_MODELS.DEFAULT.model, // "runware:106@1" (FLUX.1 Kontext [dev])
});

// または高速生成にはFLUX.1 [schnell]を使用
const fastResult = await provider.generate({
  prompt: "A beautiful landscape",
  negative: "blurry, low quality",
  width: 1024,
  height: 1024,
  format: "webp",
  seed: "abc123",
  model: RUNWARE_AIR_MODELS.FLUX_SCHNELL.model, // "runware:100@1" (FLUX.1 [schnell])
});
```

## ベストプラクティス

1. **定数を使用する**: ハードコードされた文字列の代わりに、`RUNWARE_AIR_MODELS` や `CIVITAI_MODELS` の定数を使用してください。

   ```typescript
   // ❌ 悪い例
   const model = "runware:106@1";

   // ✅ 良い例
   const model = RUNWARE_AIR_MODELS.DEFAULT.model;

   // 高速生成が必要な場合
   const fastModel = RUNWARE_AIR_MODELS.FLUX_SCHNELL.model;
   ```

2. **型ガードを活用する**: モデル形式の検証には型ガード関数を使用してください。

   ```typescript
   if (isRunwareModel(userInput)) {
     // Runwareモデルとして処理
   }
   ```

3. **説明を追加する**: 新しいモデルを追加する際は、`description` フィールドに詳細を記載してください。

4. **デフォルト値を尊重する**: 特別な理由がない限り、デフォルト設定を使用してください。

## 参考リンク

- [Runware AIR Models Documentation](https://docs.runware.ai/en/image-inference/models/air-models)
- [Civitai Models](https://civitai.com/)
