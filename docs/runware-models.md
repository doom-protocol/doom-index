# Runware Models Configuration

このドキュメントでは、Runware画像生成モデルの設定と使用方法について説明します。

## 概要

Runwareは以下のモデル形式をサポートしています：

1. **Runware AIR Models**: `runware:aid@version` 形式

すべてのモデル設定は `src/constants/runware.ts` で一元管理されています。

## 定数の使用

### 基本的な使用方法

```typescript
import {
  RUNWARE_AIR_MODELS,
  DEFAULT_RUNWARE_MODEL,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_RUNWARE_TIMEOUT,
} from "@/constants/runware";

// デフォルトモデルを使用
const model = DEFAULT_RUNWARE_MODEL; // "runware:106@1" (FLUX.1 Kontext [dev])

// 事前定義されたモデルを使用
const kontextModel = RUNWARE_AIR_MODELS.DEFAULT.model; // "runware:106@1" (FLUX.1 Kontext [dev])
const schnellModel = RUNWARE_AIR_MODELS.FLUX_SCHNELL.model; // "runware:100@1" (FLUX.1 [schnell])

// デフォルト設定
const size = DEFAULT_IMAGE_SIZE; // 1024
const timeout = DEFAULT_RUNWARE_TIMEOUT; // 30000 (30秒)
```

### 型ガード関数

```typescript
import { isRunwareAirModel, isRunwareModel } from "@/constants/runware";

const model1 = "runware:100@1";
const model2 = "runware:106@1";

isRunwareAirModel(model1); // true
isRunwareAirModel(model2); // true
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

## 環境変数での設定

デフォルトモデルは環境変数 `IMAGE_MODEL` で上書きできます：

```bash
# .env または .dev.vars
IMAGE_MODEL=runware:200@1
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

1. **定数を使用する**: ハードコードされた文字列の代わりに、`RUNWARE_AIR_MODELS` の定数を使用してください。

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
