# Implementation Plan

- [ ] 1. Next.js の MDX 設定を導入（公式ガイド準拠）
  - MDX を App Router で有効化（mdx-components の用意、拡張子設定、MDX プラグイン適用）
  - 公式ガイド記載の最小構成に合わせて設定を反映（過剰なカスタムは避ける）
  - 参考: [Next.js MDX 設定](https://nextjs.org/docs/13/app/building-your-application/configuring/mdx)
  - _Requirements: 1.1, 9.1_

- [ ] 1.1 MDX 表示のベース構築（単一ソースの採用）
  - MDX をそのまま DOM として表示できる土台を整える（セマンティックな HTML を維持）
  - フロントマターの取り扱いは最小限（必要になった段階で拡張）とし、まずは本文表示を優先
  - _Requirements: 1.1, 7.1_

- [ ] 2. 3D ビューアの骨格（R3F + Drei）
  - 固定カメラ（PerspectiveCamera makeDefault）を設定し、ユーザーコントロールは提供しない
  - Html により MDX DOM を 3D 空間内に配置（距離/位置の初期値を決める）
  - Backdrop（必要に応じ Environment, ambientLight）で読みやすい背景を描画
  - _Requirements: 2.1, 2.2, 2.3, 2.4; 7.2_

- [ ] 2.1 スクロール許可とユーザー操作の制約
  - ブラウザのスクロールのみを許可し、ズーム/回転/パンは無効
  - スクロールに伴う不要な再描画や無駄な計算を抑制
  - _Requirements: 2.1, 2.2; 3.2_

- [ ] 3. 背景スタイルの最小実装
  - 既存ギャラリーに近い静的意匠を Backdrop/ライトで再現（過度な影/反射なし）
  - モバイル/デスクトップ双方で視認性を満たす配色とコントラスト
  - _Requirements: 2.4; 6.1, 6.2, 6.3_

- [ ] 4. レスポンシブ動作と簡易化モード
  - ビューポート幅に応じて 3D 背景を簡易化/非表示に切替
  - どのサイズでも MDX の縦スクロール読書が快適であることを確認
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 5. アクセシビリティ（OGP は全ページ統一のまま）
  - MDX 出力のセマンティック HTML を維持
  - 3D コンテナに aria-hidden=true を適用（本文はスクリーンリーダー読み上げ可能）
  - 既存の OGP 設定は変更しない（本ページ固有の OGP は設定しない）
  - _Requirements: 7.1, 7.2_

- [ ] 6. 実行環境制約とパフォーマンス
  - Cloudflare Workers 前提で画像変換/重いバイナリ処理を避ける
  - 不要なオフスクリーン描画・再計測を抑制（requestAnimationFrame の最小化）
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 7. ビルドパイプライン整合
  - CI で MDX→HTML を生成し、画像変換成果物を生成/配置しないことを確認
  - 生成件数と経過時間をログに記録
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 8. テスト
  - Unit: MDX 表示（セマンティック要素の存在検証）/ 固定カメラ設定の確認
  - Integration: About ページでの MDX 表示と 3D 背景の共存
  - E2E: 主要な読書動線（スクロールのみ）と表示崩れの有無を確認
  - _Requirements: 2.1, 2.3; 7.1_
