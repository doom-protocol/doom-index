# Mint NFT Implementation Plan

## Round 1: GLB Export (Completed)

- [x] 1. 環境セットアップと依存関係の追加
  - three-stdlib をインストールして GLTFExporter を利用可能にする
  - 型安全な環境変数検証を設定（必要最小限）
  - _Requirements: 1.1_

- [x] 2. GLB エクスポートサービスの実装
  - FramedPainting から絵画モデル（frame.glb + webp テクスチャ）を抽出する機能を実装
  - GLTFExporter を使用してバイナリ GLB を生成
  - File オブジェクトとして返す機能を追加
  - バックグラウンドで非同期実行できるように設計
  - _Requirements: 1.1, 1.4_

- [x] 3. GLB エクスポートの最適化ロジック実装
  - 生成された GLB が 32MB を超える場合のメッシュ簡略化を実装
  - WebP テクスチャ圧縮を適用してファイルサイズを削減
  - 最適化後のサイズ検証機能を追加
  - _Requirements: 1.1, 1.2_

- [x] 4. Mint ボタン UI コンポーネントの実装
  - GLB エクスポートをトリガーするボタンコンポーネントを作成
  - エクスポート進行中のローディング状態を表示
  - エクスポート完了時のダウンロードまたは保存機能を追加
  - _Requirements: 1.1, 1.3_

- [x] 5. ギャラリーシーンへの Mint ボタン統合
  - FramedPainting の近くに Mint ボタンを配置
  - クリック時に GLB エクスポートを開始
  - 現在の絵画情報を GLB エクスポートサービスに渡す
  - _Requirements: 1.1_

- [x] 6. エラーハンドリングとリトライロジックの実装
  - GLB エクスポート失敗時のエラーメッセージを表示
  - リトライ機能を備えたエラーハンドリングを実装
  - ユーザーにとって分かりやすいエラー通知を提供
  - _Requirements: 1.2_

- [x] 7. GLB エクスポート機能のユニットテスト実装
  - GLB エクスポート機能の正常系テストを作成
  - エラーケース（無効なシーン、メモリ不足等）をテスト
  - バックグラウンド実行のテストを実装
  - _Requirements: 1.1, 1.4_

## Round 2: IPFS Upload & Solana Minting

- [x] 8. Pinata 統合とサーバーサイド実装
  - `pinata` (v3) パッケージをインストール
  - `PINATA_JWT` を `src/env.ts` に追加（server-side only）
  - `src/server/trpc/routers/ipfs.ts` を作成し `createSignedUploadUrl` プロシージャを実装
  - メインの tRPC ルーターに `ipfs` ルーターを統合
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 9. クライアントサイド IPFS アップロード実装
  - `useIpfsUpload` フックを実装（署名付き URL 取得 -> 直接アップロード）
  - `MetadataBuilder` ユーティリティを実装（Metaplex 標準準拠 JSON 生成）
  - アップロード進行状況（progress）の監視処理を実装
  - アップロード失敗時のリトライロジックとエラーハンドリングを追加
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.4_

- [x] 10. Solana ウォレット接続と契約統合
  - `@solana/web3.js`, `@metaplex-foundation/umi` 等をインストール
  - `NEXT_PUBLIC_SOLANA_RPC_URL` を `src/env.ts` に追加
  - `useSolanaWallet` フックを実装（接続、署名、送信）
  - `useSolanaMint` フックを実装（Metaplex Token Metadata による NFT ミント）
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.2, 7.1_

- [x] 11. Mint モーダル UI と統合フロー実装
  - `MintModal` コンポーネントを作成し、ステップ遷移（Upload -> Connect -> Mint -> Success/Error）を実装
  - 既存の `MintButton` と GLB エクスポート機能をモーダルフローに統合
  - 進行状況表示とエラーハンドリング UI を実装
  - ミントトランザクションの署名フローと完了画面（Explorer Link）を実装
  - _Requirements: 6.1, 6.3, 6.4, 5.4, 4.4_

- [x] 12. 統合テストと検証
  - すべてのユニットテストが通過（378 pass, 0 fail）
  - 型チェックが通過（TypeScript strict mode）
  - Pinata クライアント、IPFS アップロード、メタデータビルダーのテスト実装済み
  - tRPC ルーターのテスト実装済み
  - _Requirements: 6.4, 3.7, 5.2_
