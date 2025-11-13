# Design Document

## Overview
本機能は About ページで MDX を唯一の情報源とした静的ドキュメントを「そのまま」表示し、R3F の Html を用いて 3D 空間内に配置する。背景は R3F で描画し、読書体験は通常の Web ドキュメントと同一（スクロールのみ許可）。カメラは固定し、回転/ズーム/パンは無効化する。Cloudflare Workers 環境に合わせ、画像変換や PDF 生成等の重い処理は行わない。

### Goals
- MDX 単一ソースからの DOM 表示
- カメラ固定かつスクロールのみ許可した 3D 背景との調和
- Cloudflare Workers 前提の軽量な配信と安定動作

### Non Goals
- PDF 生成や画像変換などの重いビルド処理
- 3D でのページテクスチャ全面レンダリングや複雑なインタラクション
- 新規ストレージやバックエンド API の追加

## Architecture

### Existing Architecture Analysis
- Nextjs App Router 構成に準拠し Server Component を優先する
- 3D ギャラリーは既存の gallery コンポーネント群に整合する設計とする
- Cloudflare Workers と Pages による配信前提で静的アセットの配布を最適化する

### Component Composition（擬似 React 構成）

```tsx
// app/about/page.tsx  Server Component (Next.js App Router)
import WhitepaperViewer from "@/components/about/whitepaper-viewer"; // Client
import MDXArticle from "@/components/about/mdx-article";              // Server
// 例: import Article from "@/components/about/whitepaper/doom-index-v1.mdx";

const Page = async () => {
  // メタはフロントマター/静的定義から
  return (
    <WhitepaperViewer>
      <MDXArticle /> {/* そのままのMDXをDOMとして描画 */}
    </WhitepaperViewer>
  );
};
export default Page;
```

```tsx
// components/about/whitepaper-viewer.tsx  Client Component
"use client";
import { Canvas } from "@react-three/fiber";
import { Html, PerspectiveCamera, Backdrop, Environment, Grid, Stats } from "@react-three/drei";
import type { PropsWithChildren } from "react";

export default function WhitepaperViewer({ children }: PropsWithChildren) {
  return (
    <Canvas
      camera={{ fov: 50, position: [0, 0, 3], near: 0.1, far: 100 }}
      gl={{ antialias: true }}
      style={{ width: "100vw", height: "100vh", position: "fixed", inset: 0 }}
      onCreated={({ gl }) => {
        // ACESFilmic 等は必要最小限のみ
      }}
    >
      {/* カメラ固定（コントロール無し）。PerspectiveCamera を明示して makeDefault */}
      <PerspectiveCamera makeDefault fov={50} position={[0, 0, 3]} near={0.1} far={100} />

      {/* 背景: drei Backdrop を活用（読みやすさ重視。影は最小限 or 無効） */}
      <Backdrop receiveShadow={false} scale={[6, 4, 1]} position={[0, 0, -1]}>
        {/* 必要なら color/roughness など調整 */}
      </Backdrop>
      {/* 環境光は Environment（低強度）か素朴な ambientLight を選択 */}
      {/* <Environment preset="city" blur={0.8} /> */}
      <ambientLight intensity={0.6} />

      {/* 開発支援（dev のみ） */}
      {/* <Grid args={[10, 10]} /> */}
      {/* <Stats /> */}

      {/* MDX本文を 3D 空間内に Html で配置（距離・座標は固定） */}
      <group /* 任意: カメラ近傍固定にするならカメラ姿勢を反映 */>
        <Html transform distanceFactor={1.0} /* スタイルはCSSで */>
          <div className="whitepaper-article">{children}</div>
        </Html>
      </group>
    </Canvas>
  );
}
```

```tsx
// components/about/mdx-article.tsx  Server Component
// Next.js MDXの基本: https://nextjs.org/docs/13/app/building-your-application/configuring/mdx
// 例: components/about/whitepaper/doom-index-v1.mdx を直接importして返す
import Article from "@/components/about/whitepaper/doom-index-v1.mdx";

const MDXArticle = () => {
  return (
    <article>
      <Article />
    </article>
  );
};
export default MDXArticle;
```

### Technology Alignment and Key Decisions
- **Decision**: DOM 表示を採用し Html レイヤで 3D に統合  
  - Context: Workers 制約と A11y SEO 要求に適合  
  - Alternatives: ページ画像テクスチャ化 画像変換 3D 内テキスト  
  - Selected: DOM を主軸とし、R3F は背景と Html による配置で最小限活用（drei を優先採用）  
  - Rationale: 低コスト 高可読 高アクセシビリティ  
  - Trade offs: 3D 演出は最小限
- **Decision**: カメラ固定とスクロールのみ許可  
  - Context: 読書体験の一貫性  
  - Alternatives: ユーザー回転 ズーム パン  
  - Selected: 固定カメラで没入を阻害しない  
  - Rationale: 読みやすさ優先  
  - Trade offs: 3D 操作の自由度低下
- **Decision**: 画像変換や PDF 生成は行わない  
  - Context: Workers 制約と運用簡素化  
  - Alternatives: WebP 連番 Playwright PDF  
  - Selected: 非採用  
  - Rationale: コスト削減 配信シンプル化  
  - Trade offs: ダウンロード用 PDF の未提供

## Rendering Flow（Next.js / MDX / R3F）
- Next.js Server（app/about/page.tsx）で MDX を Server Component（`MDXArticle`）として読み込み
- Composition Pattern: Server の `MDXArticle` を Client の `WhitepaperViewer` の children に渡す
- Client 側 R3F Canvas 上で:
  - 背景（壁/床/ライト）を最小構成で描画（ギャラリーと意匠整合）
  - カメラは固定、ユーザー操作はスクロールのみ
  - `<Html>` で children（MDX DOM）を 3D 空間内に配置（距離・位置は固定）
- スクロールはブラウザ標準に委譲（R3F 側は特別な同期を行わない）

## Components and Interfaces

### About page（最小分割）
Responsibility and Boundaries
- Primary Responsibility: About ページの構成とメタタグ設定
- Domain Boundary: Web 表示とナビゲーション
- Data Ownership: MDX 本文 HTML とメタ情報
- Transaction Boundary: なし

Dependencies
- Inbound: ルーティング
- Outbound: MDXContent R3FBackground
- External: なし

Contract Definition
- Props なし
- 子要素として MDXContent と R3FBackground を組み合わせる

#### MDXContent（Server）
Responsibility and Boundaries
- Primary Responsibility: MDX をセマンティックな HTML に変換して表示
- Domain Boundary: コンテンツ表示
- Data Ownership: 変換済み HTML とメタ情報

Dependencies
- Outbound: なし

Contract Definition
```typescript
export interface WhitepaperMeta {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export interface MDXContentProps {
  sourcePath: string;
}
```

#### R3FBackground / Html 配置（Client）
Responsibility and Boundaries
- Primary Responsibility: 背景演出（壁/床/照明 等）。本文は Html で3D空間に配置
- Domain Boundary: 3D 演出
- Data Ownership: なし

Dependencies
- Outbound: 背景メッシュ ライト

Contract Definition
```typescript
export interface R3FBackgroundProps {
  quality?: "low" | "medium" | "high";
}
```
- Preconditions: WebGL 利用可またはフォールバック前提
- Postconditions: カメラ固定 背景のみ描画
- Invariants: ユーザー操作はスクロールのみ

## Directory Structure
- `src/components/about/whitepaper/doom-index-v1.mdx`  MDX 本文（コンポーネント配下に配置）
- `src/app/about/page.tsx`                ページ本体（Server）
- `src/components/about/whitepaper-viewer.tsx`  R3F Canvas + Html 配置（Client）
- `src/components/about/mdx-article.tsx`        MDX を返す Server コンポーネント
- （任意）`src/components/about/background.tsx` 背景メッシュ/ライト（Client）

## Data Models
- WhitepaperMeta: タイトル 説明 OGP 用メタ

## Utilities / Pure Functions（切り出し指針）
- `src/lib/pure/camera.ts`:
  - `getFixedCameraConfig(): { fov: number; position: [number,number,number]; near: number; far: number }`
- `src/lib/pure/placement.ts`:
  - `computeDistanceFactor(width: number): number`  // 画面幅に基づく Html の distanceFactor
- `src/utils/webgl.ts`:
  - `isWebGLAvailable(): boolean`
- `src/utils/mdx.ts`:
  - `extractFrontmatter(meta: unknown): WhitepaperMeta`  // フロントマターからメタ抽出

## Error Handling
- three 初期化に失敗した場合は背景描画をスキップし、MDX 本文のみ表示を継続
- 重大エラーはログ出力を行いページ表示は継続
- 未対応ブラウザの場合はフォールバックを強制

## Testing Strategy
- Unit: MDX 変換 成果のセマンティック要素存在確認
- Integration: About ページでの MDX 表示と R3F 背景の共存
- E2E: three 不可時の背景スキップと本文継続表示
- Performance: 低スペック環境でのスクロール追従確認

## Security Considerations
- クライアント側のみの表示機能であり機密データを扱わない
- 外部入力は MDX のビルド時にサニタイズされた HTML を出力

## Performance and Scalability
- カメラ固定により計算コストを最小化
- 再レンダリングを抑制するためのメモ化と requestAnimationFrame 制御
- 画像変換や重い I O を排除

## Use of Drei / React Three Fiber（再発明防止）
- Html: MDX DOM を 3D 空間に正しく配置するために標準採用
- PerspectiveCamera: 固定カメラ設定をコンポーネントで宣言的に適用（makeDefault）
- Backdrop: シンプルな背景曲面で読みやすさ重視の空間を作成（手書きの壁/床メッシュを廃止）
- Environment（任意）: 低強度の環境光で簡易ライティング（必要に応じて ambientLight のみ）
- Grid/Stats（dev のみ）: デバッグ用に簡易表示（本番ビルドでは無効）
- Controls は不採用: 読書体験を守るため、回転/ズーム/パンは提供しない（カメラ固定）
