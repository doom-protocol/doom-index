# Top page 初回ロードで画像と GLTF の表示が遅い

## 背景

トップページ初回表示時に、絵画画像と `frame.glb` の読み込み完了までかなり時間がかかる。体感では 10 秒前後かかるケースがあり、ファーストビューの印象を大きく損ねている。

## 症状

- トップページ初回表示時、額縁モデルと絵画テクスチャの表示まで待ち時間が長い
- 画像が出るまでプレースホルダー表示が長く続く
- 初回は特に重いが、2 回目以降はブラウザキャッシュの影響で相対的に速い

## 調査結果

### 1. 額縁モデル `public/frame.glb` が大きすぎる

- `public/frame.glb` は約 `10MB`
- トップページの額縁は `useGLTF("/frame.glb")` で初回表示時に必ず取得される
- `useGLTF.preload("/frame.glb")` は入っているが、これは JS 実行後の preload なので、HTML レベルの preload にはなっていない

関連箇所:

- `src/components/ui/framed-painting-base.tsx`
- `src/components/gallery/framed-painting.tsx`
- `public/frame.glb`

### 2. プレースホルダー画像が約 `2.3MB` あり、しかも初回はフルサイズで読まれている

- `GalleryScene` は `useLatestPainting()` の結果が返るまで `"/placeholder-painting.webp"` を使う
- `public/placeholder-painting.webp` は約 `2.3MB`
- `getImageUrlWithDpr()` は `/api/r2/*` 以外の public asset には変換を掛けず、そのまま返す実装になっている
- そのため 3D テクスチャとしても、初回は最適化されていない重い placeholder を丸ごと取得している

関連箇所:

- `src/components/gallery/gallery-scene.tsx`
- `src/components/gallery/framed-painting.tsx`
- `src/lib/cloudflare-image.ts`
- `public/placeholder-painting.webp`

### 3. 初回は「placeholder 取得」のあとに「最新絵画の取得」が直列で発生する

- 初期表示では placeholder を描画
- その後 `useLatestPainting()` がクライアント側で `paintings.list(limit: 1)` を叩いて最新画像 URL を取得
- URL 確定後に、本番の絵画テクスチャを追加で取得する
- つまり初回は「重い placeholder」と「実画像」の 2 回の画像取得が起きやすい

関連箇所:

- `src/hooks/use-latest-painting.ts`
- `src/server/trpc/routers/paintings.ts`
- `src/server/services/paintings/list.ts`

### 4. 最新絵画メタデータ取得がクライアント hydration 後まで遅延している

- `src/app/page.tsx` は `GalleryScene` を `dynamic(..., { ssr: false })` で丸ごと client-only 化している
- 最新絵画の取得も `useLatestPainting()` の client query 依存なので、初回 HTML に最新画像 URL が含まれない
- 結果として、初回表示は「HTML → JS chunk 読み込み → hydrate → tRPC → 画像ロード」という順番になる

関連箇所:

- `src/app/page.tsx`
- `src/components/gallery/gallery-scene.tsx`
- `src/hooks/use-latest-painting.ts`

### 5. ホームで不要な依存が初回 JS に混ざっている可能性が高い

- ルートレイアウトで `Providers` を常時マウントしており、その中で Solana wallet / Umi / viewer worker を起動している
- ビルド済み client chunk `.next/static/chunks/lib-a35936198b2cc0e4.js` は約 `2.9MB`
- その chunk 内には `three`, `@react-three/fiber`, `@solana`, `wallet-adapter`, `pinata`, `leva` などが同居していることを確認
- 少なくとも「トップページ表示に不要な依存まで最初に飲み込んでいる」構成になっている

関連箇所:

- `src/app/layout.tsx`
- `src/app/providers.tsx`
- `src/components/providers/wallet-adapter-provider.tsx`
- `src/components/providers/umi-provider.tsx`

## 原因のまとめ

初回表示が遅い主因は 1 つではなく、以下の複合だと考えられる。

1. `frame.glb` が 10MB と重い
2. placeholder が 2.3MB で、しかも public asset 扱いのため変換されずフルサイズでロードされる
3. 最新絵画 URL の取得が client-side query 待ちなので、画像ロード開始までに 1 往復余計にかかる
4. ルートレベルで重い依存を抱えており、初回 JS が太い

## 推奨対応

### 優先度 High

1. `frame.glb` を圧縮または置き換える
   - Draco / Meshopt / glTF-Transform 等で圧縮する
   - 見た目を維持したままポリゴン数を削減する
   - 可能ならホームだけ別の軽量モデル、または procedural な frame へ置き換える
   - 目標: `10MB -> 1MB 未満`

2. placeholder を別物にする
   - `public/placeholder-painting.webp` を極小サイズに作り直す
   - もしくは placeholder も `/api/r2` 経由の変換対象にして、3D 用には 256-512px 程度に制限する
   - 初回に 2.3MB の placeholder を取らないようにする

3. 最新絵画メタデータを server side で先に埋め込む
   - `page.tsx` もしくは親の Server Component で最新絵画を先に取得し、`GalleryScene` に初期値として渡す
   - これにより「hydrate 後に初めて URL が分かる」状態をやめる
   - 少なくとも初回は placeholder を経由せず最新画像 URL をすぐ使えるようにする

### 優先度 Medium

4. wallet / mint 系依存をトップページの初回バンドルから外す
   - `WalletAdapterProvider` と `UmiProvider` を root 常駐させず、mint 導線に入った時だけ mount する
   - 少なくともトップページの初回表示では Solana 関連を遅延ロードに寄せる

5. `GalleryScene` のロード戦略を見直す
   - `dynamic(..., { ssr: false })` 自体は維持してもよいが、最新絵画 metadata だけは server で先出しする
   - `frame.glb` とテクスチャを `<link rel="preload">` で事前ロードする余地を検討する

6. 3D 表示前に軽量 2D fallback を出す
   - 初回は静止画像または CSS frame で即時表示し、3D は裏で準備完了後に差し替える
   - 「3D が出るまで何も見えない」時間を縮める

## 受け入れ条件

- トップページ初回表示で、主要表示までの待ち時間が明確に短縮される
- 初回ロード時に取得する主要 asset の総量が大きく減る
- placeholder がフルサイズで読まれない
- 最新絵画 URL が hydration 後の tRPC 完了待ちにならない
- wallet / mint 非利用時に Solana 関連コードが初回表示のボトルネックにならない

## 補足

- ローカル preview では `/api/trpc/paintings.list?limit=1` が約 `12s` かかる観測もあったが、同リクエストの実処理ログ自体は約 `48ms` で、preview 環境固有のオーバーヘッドも混ざっている可能性が高い
- ただし、本件の本質は preview 固有の遅さではなく、初回表示で重い asset と client-side 直列依存が重なっている点にある
