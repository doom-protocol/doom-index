# R2 Storage Structure

このドキュメントでは、DOOM INDEX プロジェクトで使用する Cloudflare R2 ストレージの構造とファイル形式について説明します。

## 概要

DOOM INDEX は Cloudflare R2 を永続ストレージとして使用し、以下のデータを保存します：

- **画像アーカイブ**: 生成された絵画画像とそのメタデータ
- **アプリケーション状態**: グローバル状態とトークンごとの状態

## ストレージ構造

```
r2://doom-index-storage/
├── state/
│   ├── global.json                    # グローバル状態
│   └── {ticker}.json                  # トークンごとの状態（例: co2.json, fear.json）
└── images/
    └── {YYYY}/
        └── {MM}/
            └── {DD}/
                ├── DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.webp
                └── DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.json
```

## フォルダとファイルの詳細

### `state/` フォルダ

アプリケーションの状態を保存するフォルダです。

#### `state/global.json`

グローバル状態を保存するファイルです。

**構造**:
```typescript
{
  prevHash: string | null;        // 前回のハッシュ値
  lastTs: string | null;          // 最後のタイムスタンプ（ISO 8601形式）
  imageUrl?: string | null;       // 最新の画像URL
  revenueMinute?: string | null;  // 収益計算の分バケット（ISO 8601形式）
}
```

**例**:
```json
{
  "prevHash": "abc123def456",
  "lastTs": "2025-11-14T12:34:00Z",
  "imageUrl": "/api/r2/images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp",
  "revenueMinute": "2025-11-14T12:34:00Z"
}
```

#### `state/{ticker}.json`

各トークンの状態を保存するファイルです。`{ticker}` はトークンのティッカーシンボル（例: `co2`, `fear`, `hope`）です。

**構造**:
```typescript
{
  ticker: TokenTicker;      // トークンのティッカーシンボル
  thumbnailUrl: string;     // サムネイル画像のURL
  updatedAt: string;        // 更新日時（ISO 8601形式）
}
```

**例** (`state/co2.json`):
```json
{
  "ticker": "co2",
  "thumbnailUrl": "/api/r2/images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp",
  "updatedAt": "2025-11-14T12:34:00Z"
}
```

### `images/` フォルダ

生成された絵画画像とそのメタデータを保存するフォルダです。日付ベースのプレフィックス構造（`{YYYY}/{MM}/{DD}/`）を使用して、効率的なクエリと管理を実現しています。

#### ファイル名形式

**画像ファイル**: `DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.webp`

- `{YYYYMMDDHHmm}`: タイムスタンプ（年4桁、月2桁、日2桁、時2桁、分2桁）
- `{paramsHash}`: 視覚パラメータのハッシュ（8文字、小文字）
- `{seed}`: シード値（12文字、小文字）

**メタデータファイル**: `DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.json`

画像ファイルと同じベース名で、拡張子が `.json` のファイルです。

#### パス構造

画像とメタデータは以下のパス構造で保存されます：

```
images/{YYYY}/{MM}/{DD}/DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.webp
images/{YYYY}/{MM}/{DD}/DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.json
```

**例**:
```
images/2025/11/14/DOOM_202511141234_abc12345_def456789012.webp
images/2025/11/14/DOOM_202511141234_abc12345_def456789012.json
```

#### メタデータ構造

メタデータJSONファイルには、画像生成時のパラメータと状態が保存されます。

**構造**:
```typescript
{
  id: string;                    // ファイル名ベースのID（拡張子なし）
  timestamp: string;              // ISO 8601形式のタイムスタンプ
  minuteBucket: string;           // 分バケット（例: "2025-11-14T12:34:00Z"）
  paramsHash: string;             // 視覚パラメータのハッシュ（8文字）
  seed: string;                   // シード値（12文字）
  mcRounded: McMapRounded;        // 各トークンのMC値（丸め済み）
  visualParams: VisualParams;     // 視覚パラメータ
  imageUrl: string;                // 公開URL（/api/r2/...）
  fileSize: number;               // バイト数
  prompt: string;                  // プロンプトテキスト
  negative: string;                // ネガティブプロンプト
}
```

**例**:
```json
{
  "id": "DOOM_202511141234_abc12345_def456789012",
  "timestamp": "2025-11-14T12:34:56.789Z",
  "minuteBucket": "2025-11-14T12:34:00Z",
  "paramsHash": "abc12345",
  "seed": "def456789012",
  "mcRounded": {
    "co2": 1000000,
    "fear": 500000,
    "forest": 2000000,
    "hope": 1500000,
    "ice": 800000,
    "machine": 1200000,
    "nuke": 300000,
    "pandemic": 600000
  },
  "visualParams": {
    "style": "surreal",
    "colorPalette": "dark",
    "composition": "centered"
  },
  "imageUrl": "/api/r2/images/2025/11/14/DOOM_202511141234_abc12345_def456789012.webp",
  "fileSize": 245678,
  "prompt": "A surreal oil painting depicting...",
  "negative": "blurry, low quality, distorted"
}
```

## 設計原則

### 日付ベースのプレフィックス構造

画像は日付ベースのプレフィックス構造（`images/{YYYY}/{MM}/{DD}/`）で保存されます。これにより：

- **効率的なクエリ**: 特定の日付範囲の画像を効率的に取得可能
- **自然なパーティショニング**: 日付による自動的なパーティショニング
- **スケーラビリティ**: 大量の画像を管理しやすい構造

### アトミックな保存

画像とメタデータは常にペアで保存されます：

- 画像ファイル（`.webp`）とメタデータファイル（`.json`）は必ず同時に保存される
- メタデータの保存に失敗した場合、画像も削除される（ロールバック）

### ファイル名の一意性

ファイル名は以下の要素で構成され、一意性が保証されます：

- タイムスタンプ（分単位）
- 視覚パラメータのハッシュ
- シード値

## アクセス方法

### 公開URL

R2に保存されたファイルは、以下のURL形式でアクセスできます：

```
/api/r2/{key}
```

**例**:
```
/api/r2/images/2025/11/14/DOOM_202511141234_abc12345_def456789012.webp
/api/r2/state/global.json
```

### プログラムからのアクセス

R2へのアクセスは、以下のサービスを通じて行われます：

- **`ArchiveStorageService`**: 画像とメタデータの保存
- **`ArchiveListService`**: 画像リストの取得（日付範囲でのフィルタリング対応）
- **`StateService`**: アプリケーション状態の読み書き

詳細は各サービスの実装を参照してください。

## 注意事項

### 削除された構造

以下の構造は過去に使用されていましたが、現在は削除されています：

- ルートレベルの `DOOM_*.webp` / `DOOM_*.json`
- `images/DOOM_*.webp` / `images/DOOM_*.json`（日付フォルダ構造以外）
- `revenue/` フォルダ

古い構造のファイルは `scripts/cleanup-old-r2-objects.ts` を使用して削除できます。

### 保護されるファイル

以下のファイルは削除されません：

- `state/` フォルダ内のすべてのファイル
- 新しい構造（`images/{YYYY}/{MM}/{DD}/DOOM_*.webp`）のファイル

## 関連ドキュメント

- [Archive Page Requirements](.kiro/specs/archive-page/requirements.md)
- [Archive Page Design](.kiro/specs/archive-page/design.md)
- [Development Spec](docs/development-spec.md)
