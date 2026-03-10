# 定期生成絵画の保存先を R2 から IPFS へ移行し、配信を direct gateway 化する

## 背景

NFT 実装に伴い、定期生成される絵画アセットも中央集権ストレージ前提ではなく、IPFS を一次保存先として扱いたい。

現在の定期生成フローは以下の前提で構成されている。

- 生成画像は `src/server/services/paintings/storage.ts` から `R2` に保存される
- D1 `paintings` テーブルは `r2_key` と `image_url` を保持している
- クライアントは `imageUrl=/api/r2/...` を受け取り、`src/app/api/r2/[...key]/route.ts` 経由で画像を取得する
- archive / latest painting / gallery の表示ロジックは `R2` 前提の URL 組み立てに依存している

一方で NFT まわりでは `Pinata` を使った IPFS upload の土台がすでにあり、`src/lib/pinata-client.ts` と `src/server/trpc/routers/ipfs.ts` が存在する。

今回の issue では、定期生成絵画の保存・永続化・配信経路を `R2 -> IPFS` に移し、クライアントが API プロキシではなく IPFS gateway から直接画像取得できるようにしたい。

## 現状の問題

### 1. ストレージ契約が R2 固有になっている

- `PaintingMetadata.imageUrl` が `/api/r2/...` を前提としている
- D1 スキーマが `r2_key` を持ち、永続化契約がストレージ実装に引きずられている
- `src/server/services/paintings/list.ts` でも `R2` からの補完読み込みが残っている

### 2. 画像取得が 1 hop 多い

- ブラウザ
- Next.js / Workers の `/api/r2/...`
- R2

という経路になっており、画像取得ごとにアプリケーションサーバー hop が入る。

### 3. 画像最適化とキャッシュ戦略を R2 API route に依存している

- 現在の transform / cache は `src/app/api/r2/[...key]/route.ts` に集約されている
- IPFS へ切り替えるなら、画像サイズ最適化・キャッシュ・同一 URL の不変性を別の方法で担保する必要がある

### 4. NFT とアーカイブで保存先戦略が分断される

- NFT は IPFS
- 定期生成絵画は R2

のままだと、画像参照 URL・メタデータ管理・将来の NFT 化フローが二重化する

## 目的

- 定期生成絵画の保存先を `R2` から `IPFS` に移す
- 生成完了時に IPFS URL と高速取得用 gateway URL を D1 に保存する
- 既存の `/api/r2` 経由取得をやめ、クライアントが IPFS gateway から直接画像取得する
- NFT / archive / gallery の画像参照契約を統一する
- レイテンシを下げ、初回表示と一覧表示で高速に画像を取得できるようにする

## 提案スコープ

### 1. 定期生成フローの保存先を IPFS 化する

- `src/server/services/paintings/storage.ts` の責務を見直し、画像保存を `R2` ではなく `Pinata` 経由の IPFS upload に置き換える
- 画像 upload 完了後に少なくとも以下を得る
  - `imageCid`
  - canonical `ipfs://...` URL
  - dedicated gateway の配信用 URL

### 2. D1 の永続化契約を R2 依存から外す

- `paintings` テーブルの `r2_key` 前提をやめる
- 少なくとも以下のいずれかを保持する
  - `image_cid`
  - `image_ipfs_url`
  - `image_gateway_url`
- `image_url` を残す場合も、その値は `/api/r2/...` ではなく gateway URL とする
- repository / service / schema / test fixture をこの契約に合わせて更新する

### 3. 読み取り経路を IPFS direct fetch に切り替える

- `paintings.list` や latest painting 取得で返す `imageUrl` を gateway URL にする
- gallery / archive / preload が `/api/r2/...` に依存しないようにする
- 生成画像については `src/app/api/r2/[...key]/route.ts` を経由しない

### 4. レイテンシ最適化を最初から設計に含める

- shared public gateway ではなく dedicated gateway を使う
- immutable な CID ベース URL を前提に長い cache を効かせる
- 可能なら gateway の image optimization を使い、一覧やサムネイルで過剰サイズを避ける
- D1 には「そのまま描画に使える URL」を保存し、描画前の URL 変換 hop をなくす

## 低レイテンシ要件

`IPFS にする = 遅くなる` だと意味がないので、この issue では以下を必須にしたい。

1. ブラウザからの画像取得は `app -> api -> storage` の 2 hop ではなく、gateway への direct fetch にする
2. 配信用 URL は Pinata の dedicated gateway を前提にする
3. gallery 用原寸画像と archive/list 用軽量画像で、必要なら最適化パラメータを分ける
4. `CID` は不変なので、`Cache-Control: immutable` 相当の強いキャッシュ戦略を活かす
5. 画像 URL はリクエスト時に組み立てず、保存時に確定させて D1 からそのまま返す

## 実装メモ

### データモデル

R2 固有の `r2_key` をそのまま残すより、ストレージ抽象を次のように整理したい。

- `imageCid`
- `imageIpfsUrl`
- `imageGatewayUrl`
- `fileSize`

必要なら移行期間だけ旧カラムを保持してもよいが、最終的には `R2` 固有命名を排除したい。

### 保存処理

- Cron / server 側の生成後フローで `File` or `Blob` を作成して Pinata へ upload
- upload 成功後に `CID` と gateway URL を metadata に反映
- D1 insert は upload 完了後に行う
- D1 と IPFS の整合性が崩れた場合の retry / logging 方針も決める

### 読み取り処理

- `src/server/services/paintings/list.ts` の R2 fallback をなくす
- `buildPublicR2Path()` 相当の R2 専用 util を読み取り経路から外す
- `use-latest-painting`、gallery、archive、preload test を gateway URL 前提へ更新する

### 配信戦略

- dedicated gateway を使う
- カスタムドメインを使えるなら gateway URL をプロダクトドメイン配下へ寄せることも検討する
- サムネイル / 一覧用途は image optimization クエリで幅を制限する
- full-size と thumbnail をどちらも原本 1 枚から解決するか、別アセットを持つかを決める

## 受け入れ条件

- 定期生成絵画は `R2` ではなく `IPFS` に保存される
- D1 には少なくとも `CID` と描画用 URL が保存される
- gallery / archive / latest painting は `/api/r2/...` を使わず直接 gateway URL を描画する
- 生成画像の表示に `src/app/api/r2/[...key]/route.ts` を経由しない
- 画像一覧やサムネイル取得で過剰に大きい原寸画像を毎回取らない
- 新しい保存・取得契約に合わせて repository / service / 型 / テストが更新される
- R2 依存コードが残る場合は「何のために残すのか」が明確に整理される

## 非ゴール

- 既存の全過去画像をこの issue 単体で一括移行すること
- NFT metadata / GLB upload フロー全体の作り直し
- 任意の public IPFS gateway をサポートすること

## 関連箇所

- `src/server/services/paintings/storage.ts`
- `src/server/services/paintings/list.ts`
- `src/server/services/paintings/painting-generation-orchestrator.ts`
- `src/server/repositories/paintings-repository.ts`
- `src/server/db/schema/paintings.ts`
- `src/types/paintings.ts`
- `src/utils/paintings.ts`
- `src/server/trpc/routers/paintings.ts`
- `src/app/api/r2/[...key]/route.ts`
- `src/lib/pinata-client.ts`
- `src/server/trpc/routers/ipfs.ts`

## 補足

Pinata のドキュメントでは dedicated gateway が IPFS コンテンツ取得の最速手段として案内されており、gateway 経由の image optimization も提供されている。今回の切り替えでは、単に upload 先を変えるだけでなく、配信 URL とキャッシュ戦略まで含めて設計するべき。
