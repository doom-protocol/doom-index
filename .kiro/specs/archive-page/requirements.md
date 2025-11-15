# Requirements Document

## Introduction

DOOM INDEX のアーカイブページ機能は、これまでに生成された全ての絵画を時系列で一覧表示し、各作品の生成パラメータ（Market Cap値、視覚パラメータ、シード値など）を閲覧可能にする。数万枚規模の画像を効率的に扱うため、R2ストレージの日付ベースプレフィックス構造とリスト機能を活用し、時間ベースのソート・フィルタリングを実現する。Three.js内で3Dギャラリーとして表示することで、既存の美術館体験と一貫性を保つ。

技術的には、Cloudflare R2の`list` APIによるカーソルベースのページネーション、日付ベースのプレフィックス構造（`images/{YYYY}/{MM}/{DD}/`）による効率的な時間フィルタリング、画像メタデータの必須保存・取得、React Three Fiberによる仮想化された3Dレンダリングを組み合わせて、大量データを扱いながらもUXを担保する。

**R2ストレージ構造と料金について**: R2はオブジェクトストレージであり、フォルダ構造はプレフィックス（キー名の一部）で実現される。プレフィックス構造自体は料金に影響せず、ストレージ容量（GB）とリクエスト数（読み書き操作）のみが料金に影響する。日付ベースのプレフィックス構造により、特定の日付範囲のクエリが効率的になり、全オブジェクトをスキャンする必要がなくなる。

**データ構造の設計原則**: 本機能では後方互換性を無視し、最もクリーンで効率的なデータ構造を採用する。全ての画像は日付ベースのプレフィックス構造で保存され、メタデータJSONは必須である。この構造により、クエリ効率、保守性、拡張性が最大化される。

### データ構造の定義

**R2ストレージ構造**:

```
r2://doom-index-storage/
├── images/
│   ├── {YYYY}/
│   │   ├── {MM}/
│   │   │   ├── {DD}/
│   │   │   │   ├── DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.webp
│   │   │   │   └── DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.json
```

**ファイル名形式**:

- 画像: `DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.webp`
  - `{YYYYMMDDHHmm}`: タイムスタンプ（年4桁、月2桁、日2桁、時2桁、分2桁）
  - `{paramsHash}`: 視覚パラメータのハッシュ（8文字、小文字）
  - `{seed}`: シード値（12文字、小文字）
- メタデータ: `DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.json`

**メタデータJSON構造**:

```typescript
{
  id: string; // ファイル名ベース
  timestamp: string; // ISO 8601形式
  minuteBucket: string; // 分バケット（例: "2025-11-14T12:34:00Z"）
  paramsHash: string; // 視覚パラメータのハッシュ
  seed: string; // シード値
  mcRounded: McMapRounded; // 各トークンのMC値（丸め済み）
  visualParams: VisualParams; // 視覚パラメータ
  imageUrl: string; // 公開URL
  fileSize: number; // バイト数
  prompt: string; // プロンプトテキスト
  negative: string; // ネガティブプロンプト
}
```

**例**:

- 画像パス: `images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp`
- メタデータパス: `images/2025/11/14/DOOM_202511141234_abc12345_def45678.json`

## Requirements

### Requirement 1: 画像生成時の統一されたデータ構造とメタデータ保存

**Objective:** As a System Architect, I want a clean, consistent data structure with mandatory metadata, so that archive queries are efficient and reliable.

#### Acceptance Criteria

1. WHEN 画像生成が成功したとき THEN Generation Service SHALL 画像ファイルとメタデータJSONファイルを必ず同時にR2に保存する（アトミックな操作として扱う）
2. IF メタデータ保存が失敗したとき THEN Generation Service SHALL 画像保存も失敗として扱い、トランザクション的にロールバックする（両方成功するか、両方失敗するか）
3. WHERE ファイル名を決定するとき THEN Generation Service SHALL `DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.webp`形式を厳密に使用する（例: `DOOM_202511141234_abc12345_def45678.webp`）
4. WHERE メタデータJSONファイルを保存するとき THEN Generation Service SHALL 画像ファイル名に対応する`{filename}.json`形式で保存する（例: `DOOM_202511141234_abc12345_def45678.webp` → `DOOM_202511141234_abc12345_def45678.json`）
5. WHEN メタデータJSONを構築するとき THEN Generation Service SHALL 以下の情報を必須フィールドとして含める: `id`（ファイル名ベース）、`timestamp`（ISO 8601形式）、`minuteBucket`、`paramsHash`、`seed`、`roundedMap`（各トークンのMC値、McMapRounded型）、`visualParams`（VisualParams型）、`imageUrl`（公開URL）、`fileSize`（バイト数）、`prompt`（プロンプトテキスト）、`negative`（ネガティブプロンプト）
6. WHERE 保存パスを決定するとき THEN Generation Service SHALL `minuteBucket`から年/月/日を抽出し、`images/{YYYY}/{MM}/{DD}/`プレフィックス構造で保存する（例: `images/2025/11/14/DOOM_202511141234_abc12345_def45678.webp`）
7. WHEN 画像とメタデータを保存するとき THEN Generation Service SHALL 同一ディレクトリ（同一プレフィックス）に保存し、ファイル名の対応関係を保証する
8. WHERE R2ストレージ構造を決定するとき THEN Generation Service SHALL プレフィックス（フォルダ構造）は料金に影響しないことを理解し、時間ベースのクエリ効率化を優先する
9. IF 既存の画像が新しい構造に合致しない場合 THEN Generation Service SHALL エラーを返し、新しい構造での保存を強制する（後方互換性は提供しない）

### Requirement 2: R2リストAPIによる画像一覧取得と時間ベースフィルタリング

**Objective:** As an Archive API, I want efficient pagination and time-based filtering using R2 list operations, so that large datasets can be queried efficiently without loading all objects into memory.

#### Acceptance Criteria

1. WHEN `/api/archive`エンドポイントが呼び出されたとき THEN Archive API SHALL R2の`list`メソッドを使用して`images/`プレフィックス配下のオブジェクトを取得する
2. IF `limit`クエリパラメータが指定されたとき THEN Archive API SHALL R2の`list`オプションに`limit`を設定し、最大100件まで許可する（デフォルト: 20件）
3. IF `cursor`クエリパラメータが指定されたとき THEN Archive API SHALL R2の`list`オプションに`cursor`を設定し、前回の続きから取得する
4. IF `startDate`クエリパラメータが指定されたとき THEN Archive API SHALL 日付文字列（`YYYY-MM-DD`）を解析し、`images/{YYYY}/{MM}/{DD}/`プレフィックスを使用してR2の`list`オプションに`prefix`を設定する
5. IF `endDate`クエリパラメータが指定されたとき THEN Archive API SHALL `startAfter`オプションを使用して終了日以降のオブジェクトを除外する
6. WHERE 日付範囲フィルタが適用されたとき THEN Archive API SHALL 複数の日付プレフィックスに対して並行して`list`操作を実行し、結果をマージする
7. WHERE リスト結果を返却するとき THEN Archive API SHALL 以下の形式でレスポンスする: `{ items: ArchiveItem[], cursor?: string, hasMore: boolean, totalCount?: number }`
8. WHEN リスト結果を構築するとき THEN Archive API SHALL `.webp`拡張子のオブジェクトのみを`items`に含め、対応する`.json`メタデータファイルを並行取得する
9. IF メタデータJSONファイルが存在しないとき THEN Archive API SHALL その画像をスキップし、エラーログを記録する（メタデータは必須である）
10. WHERE ページネーション情報を返却するとき THEN Archive API SHALL R2の`truncated`フラグが`true`の場合のみ`cursor`と`hasMore: true`を返す
11. WHEN 時間ベースのソートを実行するとき THEN Archive API SHALL ファイル名のタイムスタンプ部分（`DOOM_{YYYYMMDDHHmm}_...`）を解析し、メモリ内で降順ソートする（R2の`list`は辞書順のため、ファイル名設計により自然に時系列順になる）
12. WHERE 日付ベースのプレフィックス構造を活用するとき THEN Archive API SHALL `images/{YYYY}/{MM}/{DD}/`形式のプレフィックスを使用し、全オブジェクトをスキャンせずに効率的にクエリする

### Requirement 3: アーカイブアイテムの型定義とAPIレスポンス

**Objective:** As a Frontend Developer, I want consistent, type-safe archive items with mandatory fields, so that TypeScript types match API responses exactly.

#### Acceptance Criteria

1. WHEN アーカイブアイテム型を定義するとき THEN Type System SHALL 以下の必須フィールドを含める: `id`（ファイル名ベース、string）、`imageUrl`（公開URL、string）、`timestamp`（ISO 8601、string）、`minuteBucket`（string）、`paramsHash`（string）、`seed`（string）、`mcRounded`（McMapRounded型）、`visualParams`（VisualParams型）、`fileSize`（バイト数、number）、`prompt`（string）、`negative`（string）
2. WHEN メタデータJSONを読み込むとき THEN Archive API SHALL JSONから全フィールドを読み込み、型安全に`ArchiveItem`として検証する
3. IF メタデータJSONが存在しない、または必須フィールドが欠落している場合 THEN Archive API SHALL そのアイテムをスキップし、エラーログを記録する（メタデータは必須である）
4. WHEN APIレスポンスを構築するとき THEN Archive API SHALL `items`配列を`timestamp`降順（最新が先頭）でソートする
5. WHERE 型安全性を保証するとき THEN Archive API SHALL TypeScriptの型ガードを使用して、メタデータJSONの構造を検証する

### Requirement 4: アーカイブページのNext.jsルート実装

**Objective:** As a User, I want to access archive page via `/archive` route, so that I can browse historical artworks.

#### Acceptance Criteria

1. WHEN `/archive`ページがアクセスされたとき THEN Next.js Router SHALL `src/app/archive/page.tsx`をレンダリングする
2. IF ページがSSRされる場合 THEN Archive Page SHALL 初期ページ（`cursor`なし、`limit=20`）のデータを取得して表示する
3. WHERE クライアント側ナビゲーションが発生したとき THEN Archive Page SHALL React Queryを使用してページネーションを管理し、`cursor`に基づいて追加データを取得する
4. WHEN エラーが発生したとき THEN Archive Page SHALL エラーメッセージを表示し、リトライボタンを提供する

### Requirement 5: Three.js内でのアーカイブギャラリー表示

**Objective:** As a Gallery Visitor, I want archive artworks displayed in 3D space similar to main gallery, so that browsing experience is consistent and immersive.

#### Acceptance Criteria

1. WHEN アーカイブページが初期化されたとき THEN Archive Scene SHALL React Three Fiberの`Canvas`を使用して3D空間を構築し、既存の`GalleryScene`と同様の照明・背景スタイルを適用する
2. IF アーカイブアイテムが読み込まれたとき THEN Archive Scene SHALL 各画像を額縁として3D空間に配置し、グリッドレイアウトまたは時系列レイアウトで表示する
3. WHERE 大量の画像を表示するとき THEN Archive Scene SHALL 仮想化（virtualization）を実装し、ビューポート内の画像のみをレンダリングする
4. WHEN ユーザーがスクロールまたはページネーション操作を行ったとき THEN Archive Scene SHALL 新しい画像を遅延読み込みし、既に表示済みの画像はキャッシュから再利用する
5. WHERE 画像がクリックされたとき THEN Archive Scene SHALL 詳細ビュー（モーダルまたは拡大表示）を表示し、メタデータ（MC値、生成時間など）を表示する

### Requirement 6: 仮想化によるレンダリング負荷低減

**Objective:** As a Performance Engineer, I want virtualization to reduce rendering overhead, so that thousands of images can be displayed without performance degradation.

#### Acceptance Criteria

1. WHEN アーカイブアイテムが100件を超えるとき THEN Archive Scene SHALL ビューポート内の画像のみをThree.jsシーンに追加し、画面外の画像はメモリから削除する
2. IF ユーザーがスクロールしたとき THEN Archive Scene SHALL 新しいビューポート範囲を計算し、必要な画像のみを読み込み・レンダリングする
3. WHERE 画像の読み込みが進行中であるとき THEN Archive Scene SHALL プレースホルダー（低解像度サムネイルまたはスケルトン）を表示する
4. WHEN 画像テクスチャが不要になったとき THEN Archive Scene SHALL `dispose()`を呼び出してメモリを解放する
5. WHERE 仮想化のバッファ領域を設定するとき THEN Archive Scene SHALL ビューポートの上下に1画面分のバッファを設け、スクロール時のちらつきを防ぐ

### Requirement 7: ページネーションUIとナビゲーション

**Objective:** As a User, I want intuitive pagination controls, so that I can navigate through archive efficiently.

#### Acceptance Criteria

1. WHEN アーカイブページが表示されたとき THEN Archive UI SHALL ページネーションコントロール（前へ/次へ、ページ番号表示）を表示する
2. IF `hasMore`が`true`であるとき THEN Archive UI SHALL 「もっと見る」ボタンまたは無限スクロールを提供する
3. WHERE ページネーション操作が発生したとき THEN Archive UI SHALL URLクエリパラメータ（`?cursor=xxx`）を更新し、ブラウザの戻る/進むボタンで動作する
4. WHEN ローディング状態であるとき THEN Archive UI SHALL ローディングインジケータを表示し、ユーザー操作を無効化する
5. WHERE エラーが発生したとき THEN Archive UI SHALL エラーメッセージとリトライボタンを表示する

### Requirement 8: 画像メタデータの表示と時間ベースフィルタリング

**Objective:** As a Researcher, I want to view generation parameters and filter by time range, so that I can analyze artwork patterns efficiently.

#### Acceptance Criteria

1. WHEN アーカイブアイテムがクリックされたとき THEN Archive UI SHALL モーダルまたはサイドパネルで詳細情報を表示する: 生成時刻、各トークンのMC値、視覚パラメータ、シード値、ファイルサイズ
2. IF 時間ベースのフィルタリング機能が実装される場合 THEN Archive UI SHALL 日付範囲ピッカー（開始日・終了日）を提供し、`startDate`と`endDate`クエリパラメータとして送信する
3. WHERE 日付範囲フィルタが適用されたとき THEN Archive API SHALL R2の`list`オプションに日付ベースの`prefix`（例: `images/2025/11/`）と`startAfter`を使用して効率的に絞り込む
4. WHEN 時間ベースのソートが実行される場合 THEN Archive API SHALL ファイル名のタイムスタンプ部分を解析し、常に降順（最新が先頭）でソートする
5. IF 複数の日付プレフィックスにまたがるクエリが発生したとき THEN Archive API SHALL 各日付プレフィックスに対して並行して`list`操作を実行し、結果をマージしてソートする
6. WHERE フィルタリングが適用されたとき THEN Archive UI SHALL URLクエリパラメータ（`?startDate=2025-11-01&endDate=2025-11-14`）を更新し、ブラウザの戻る/進むボタンで動作する
7. WHEN メタデータが表示されるとき THEN Archive UI SHALL 読みやすい形式（日時はローカルタイムゾーン、MC値はカンマ区切りなど）でフォーマットする
8. WHERE 時間ベースのフィルタリングが実装される場合 THEN Archive UI SHALL カレンダーUIまたは日付入力フィールドを提供し、ユーザーが直感的に日付範囲を選択できるようにする

### Requirement 9: クリーンなデータ構造の強制と整合性保証

**Objective:** As a System Architect, I want strict data structure enforcement, so that the archive system maintains consistency and efficiency.

#### Acceptance Criteria

1. WHEN 画像生成が実行されたとき THEN Generation Service SHALL 新しいデータ構造（`images/{YYYY}/{MM}/{DD}/DOOM_{timestamp}_{hash}_{seed}.webp`）を厳密に使用し、旧形式の保存を許可しない
2. IF メタデータJSONの保存が失敗したとき THEN Generation Service SHALL 画像保存も失敗として扱い、トランザクション的にロールバックする
3. WHERE アーカイブAPIが呼び出されたとき THEN Archive API SHALL 新しいデータ構造に合致する画像のみを返却し、旧形式の画像は無視する
4. WHEN データ構造の整合性を検証するとき THEN System SHALL ファイル名パターン（`DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.webp`）とプレフィックス構造（`images/{YYYY}/{MM}/{DD}/`）を厳密に検証する
5. IF データ構造に合致しないオブジェクトが存在する場合 THEN Archive API SHALL それらをスキップし、エラーログを記録する（後方互換性は提供しない）
6. WHERE メタデータJSONの構造を検証するとき THEN Archive API SHALL 必須フィールドの存在を確認し、欠落している場合はエラーとして扱う

### Requirement 10: パフォーマンス最適化とキャッシュ戦略

**Objective:** As a Performance Engineer, I want efficient caching and query optimization, so that archive page loads quickly even with large datasets.

#### Acceptance Criteria

1. WHEN アーカイブAPIが呼び出されたとき THEN Archive API SHALL React Queryのキャッシュを活用し、同一`cursor`とフィルタ条件のリクエストはキャッシュから返す
2. IF メタデータJSONの読み込みが並行実行される場合 THEN Archive API SHALL `Promise.allSettled`を使用してエラー耐性を確保する
3. WHERE 画像URLを構築するとき THEN Archive API SHALL 既存の`/api/r2/[...key]`ルートを使用し、CDNキャッシュを活用する
4. WHEN アーカイブページがSSRされる場合 THEN Archive Page SHALL 初期ページのみをSSRし、追加ページはクライアント側で取得する
5. WHERE 画像のプリロードが実装される場合 THEN Archive Scene SHALL 次のページの画像をバックグラウンドでプリロードする
6. WHEN 日付範囲フィルタが適用されたとき THEN Archive API SHALL 日付ベースのプレフィックス構造により、R2の`list`操作が効率的に実行される（全オブジェクトをスキャンする必要がない）
7. WHERE R2ストレージの料金を考慮するとき THEN System SHALL プレフィックス（フォルダ構造）は料金に影響せず、ストレージ容量とリクエスト数のみが料金に影響することを理解する
