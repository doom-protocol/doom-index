# Top page 初回表示時に lighting がロード後に切り替わってチラつく

## 背景

トップページを開いた直後、額縁や scene の読み込みが進むタイミングで lighting が切り替わり、見た目が一度乱れる。最初に左上から右方向へ当たる簡易ライトで表示され、その後に本来のライティングへ差し替わるため、チカチカした印象になる。

## 症状

- 初回表示の最初の数フレームで、左上から右方向へ当たるライトが見える
- その後、scene / frame のロードが進むタイミングで lighting が別構成に切り替わる
- ユーザー視点では「scene が表示されたあとに照明設計が変わった」ように見え、安定しない

## 調査結果

### 1. `GalleryScene` の `Lights` が `dynamic()` で読み込まれており、初回 fallback が本番 lighting と別物

- `src/components/gallery/gallery-scene.tsx` では `./lights` を `dynamic(..., { ssr: false })` で読み込んでいる
- その `loading` fallback は次の簡易 lighting のみ
  - `ambientLight intensity={0.5} color="#323248"`
  - `directionalLight position={[-1.5, 2.5, 3]} intensity={0.8} color="#f6e3c4"`
- 一方で、読み込み後に mount される `Lights` のデフォルトは `variant="full"` で、spotLight / hemisphereLight / pointLight 群を使うまったく別の構成

関連箇所:

- `src/components/gallery/gallery-scene.tsx`
- `src/components/gallery/lights.tsx`

### 2. fallback の directional light が「左上から右方向のライト」に見えており、ユーザー報告と一致する

- fallback の directional light は `position={[-1.5, 2.5, 3]}`
- これはまさに「左上から右方向に当たる」初期 lighting に相当する
- 読み込み後は full lighting に置き換わるため、見た目が連続しない

関連箇所:

- `src/components/gallery/gallery-scene.tsx`

### 3. full lighting は構成だけでなく shadow / target 設定も含むため、差し替え時の見た目変化が大きい

- `src/components/gallery/lights.tsx` の `FullLights` は ambient / hemisphere / directional に加えて、hero spotlight、fill spotlight、複数の point light、floor glow を描画する
- さらに `useFrame()` で spotlight target と shadow bias を初期化している
- そのため simple fallback から full lighting へ切り替わると、明るさ・方向・影・反射の見え方が一気に変わる

関連箇所:

- `src/components/gallery/lights.tsx`

## 原因のまとめ

主因は、トップページの scene が最初から最終 lighting で描画されていないことにある。`GalleryScene` が simple fallback light を先に表示し、`./lights` のロード完了後に full lighting へ差し替える設計なので、frame や scene の読み込みと重なった瞬間に lighting が変わって見える。

## 期待される挙動

- scene が初めて render された瞬間から、最終的に使う lighting と同じ見た目で安定している
- frame / texture / scene のロード進行によって lighting 設計が途中で切り替わらない
- 少なくともユーザーが認識できるレベルの lighting flicker がない

## 推奨対応

1. `GalleryScene` の初期表示でも final lighting と同じ構成を使う
   - `dynamic()` の fallback をやめる
   - もしくは fallback を full lighting と見た目が一致する構成へ揃える

2. dev-only な制御 UI と production lighting を分離する
   - hydration 回避のために `Lights` 全体を `dynamic()` にするのではなく、必要なら Leva だけを遅延ロードする
   - 本番で使う lighting ノード自体は最初から同期的に描画する

3. 初回 render と load 完了後で lighting tree が変わらないようにする
   - scene / frame のロードに関係なく、同じ light types / target / shadow 設定を維持する

## 受け入れ条件

- トップページ初回表示時、lighting が途中で simple から full に切り替わらない
- 初回の最初のフレームから、最終表示と同等の lighting で scene が見える
- frame / texture のロード完了後も、ユーザーが認識できる lighting flicker が発生しない
