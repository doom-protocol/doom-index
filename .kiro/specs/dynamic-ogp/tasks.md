# 実装計画 — dynamic-ogp

## 概要

Dynamic OGP 機能は、Next.js の `opengraph-image.tsx` ファイル規約と `next/og` の `ImageResponse` API を活用し、ソーシャルプラットフォームで共有される OGP 画像を動的に生成する機能です。R2 に保存された 1:1 の正方形画像を 1200×630 px のレターボックス形式に変換し、ISR により 60 秒ごとに再生成します。

## 実装タスク

- [x] 1. OGP 画像生成のルートハンドラー実装
- [x] 1.1 opengraph-image.tsx の基本構造を作成
  - Next.js の opengraph-image ファイル規約に従ってルートハンドラーを作成
  - ISR 設定（revalidate = 60）、画像サイズ（1200×630）、alt テキストをエクスポート
  - ImageResponse を返すデフォルトエクスポート関数を実装
  - _Requirements: 1.1, 4.1, 4.2, 4.3_

- [x] 1.2 R2 からグローバル state を取得する機能を実装
  - 既存の `lib/r2.ts` の `getJsonFromPublicUrl` を使用して state/global.json を取得
  - `R2_PUBLIC_DOMAIN` 環境変数から R2 公開 URL を構築
  - Result 型でエラーハンドリングを実装
  - _Requirements: 1.2, 3.2, 5.1_

- [x] 1.3 R2 から画像バイナリを取得して base64 に変換する機能を実装
  - `imageUrl` から画像を fetch（GlobalState 型では `imageUrl` フィールドを使用）
  - ArrayBuffer として読み込み、base64 dataURL に変換
  - webp 形式を `data:image/webp;base64,...` として処理
  - _Requirements: 1.2, 1.4_

- [x] 2. レターボックス形式での画像合成機能を実装
- [x] 2.1 ImageResponse で黒背景コンテナを作成
  - JSX で `display: flex`、`width: 100%`、`height: 100%`、`background: #000000` のコンテナを実装
  - `alignItems: center`、`justifyContent: center` で中央配置
  - 1200×630 px の出力サイズを設定
  - _Requirements: 1.1, 1.3, 1.4_

- [x] 2.2 正方形画像を中央配置してレターボックスを生成
  - `<img>` タグで base64 dataURL を src に設定
  - `height: 100%`、`width: auto`、`objectFit: contain` で高さ基準のスケーリング
  - 左右の余白が自動的に黒で埋まることを確認
  - _Requirements: 1.3, 1.4_

- [x] 2.3 キャッシュヘッダーを設定
  - ImageResponse のオプションで headers を指定
  - `Cache-Control: public, max-age=60, stale-while-revalidate=30` を設定
  - contentType を `image/png` として確認
  - _Requirements: 1.6, 3.1, 3.3_

- [x] 3. プレースホルダフォールバック機能を実装
- [x] 3.1 プレースホルダ画像の読み込み機能を実装
  - R2 取得失敗時のフォールバックロジックを追加
  - `public/placeholder-painting.webp` を fetch で読み込み
  - base64 に変換して ImageResponse で使用
  - _Requirements: 1.5, 5.1, 5.2_

- [x] 3.2 プレースホルダ用の ImageResponse を生成
  - プレースホルダ画像を同じレターボックス形式で配置
  - 黒背景コンテナと中央配置を維持
  - プレースホルダ専用のキャッシュヘッダー（max-age=300）を設定
  - _Requirements: 1.5, 3.5, 5.2_

- [x] 3.3 エラーハンドリングとログ出力を実装
  - R2 fetch 失敗時に `logger.warn` でログ出力
  - プレースホルダ使用フラグ（useFallback）を記録
  - 例外発生時は `logger.error` でスタックトレースを記録
  - _Requirements: 5.1, 5.3, 8.1, 8.2, 8.5_

- [x] 4. OGP メタデータ生成機能を実装
- [x] 4.1 layout.tsx に generateMetadata を追加
  - 既存の layout.tsx の metadata 設定を関数ベースに変更
  - async function generateMetadata を実装
  - R2 から state/global.json を取得（オプション）
  - _Requirements: 2.1, 2.5_

- [x] 4.2 openGraph メタデータを設定
  - title を "DOOM INDEX - World State Visualization" に設定
  - description に 8 トークンの説明を含める
  - openGraph.images に `/opengraph-image` を設定（width: 1200, height: 630）
  - openGraph.type、siteName、locale を設定
  - _Requirements: 2.2, 2.4_

- [x] 4.3 Twitter カード用メタデータを設定
  - twitter.card を "summary_large_image" に設定
  - twitter.site を "@doomindex" に設定
  - twitter.title、description、images を openGraph と同一内容で設定
  - _Requirements: 2.3_

- [x] 4.4 R2 取得失敗時のデフォルトメタデータを実装
  - state 取得失敗時のフォールバックロジックを追加
  - デフォルトの title と description を返す
  - logger.warn でエラーを記録
  - _Requirements: 2.5, 5.5_

- [x] 5. ソーシャルクローラアクセスのログ記録機能を実装
- [x] 5.1 User-Agent 検出ロジックを実装
  - opengraph-image.tsx でアクセスログを記録
  - 構造化ログとして route、fallbackUsed、durationMs を記録
  - 必要に応じて headers から User-Agent を取得可能
  - _Requirements: 8.3_

- [x] 5.2 構造化ログの出力を実装
  - 画像生成完了時に route、stateFound、fallbackUsed、responseTimeMs を記録
  - 開始時刻と終了時刻を計測してレスポンス時間を算出
  - logger.info/logger.error で Cloudflare Logs に出力
  - _Requirements: 8.1, 8.4_

- [x] 6. ローカル開発環境でのテストと検証
- [x] 6.1 ローカル環境での動作確認
  - テストスイートを作成し、ユーティリティ関数の動作を検証
  - base64 変換、エラーハンドリング、キャッシュヘッダーロジックをテスト
  - 全 13 テストが成功
  - _Requirements: All_

- [x] 6.2 レターボックス形式の視覚的検証
  - ImageResponse の JSX 構造で 1200×630 レターボックス形式を実装
  - 黒背景コンテナと中央配置を確認
  - objectFit: contain で高さ基準のスケーリングを設定
  - _Requirements: 1.3, 2.2_

- [x] 6.3 プレースホルダフォールバックの動作確認
  - getArtworkDataUrl 関数で R2 エラー時のフォールバックを実装
  - fallbackUsed フラグでプレースホルダ使用を記録
  - logger.warn でフォールバック使用をログ出力
  - _Requirements: 5.1, 5.2, 8.2_

- [ ] 7. ソーシャルプラットフォームでの検証
- [ ] 7.1 Twitter Card Validator で検証
  - 本番環境にデプロイ後、Twitter Card Validator にアクセス
  - メインページ URL を入力してプレビューを確認
  - 画像、タイトル、説明文が正しく表示されることを確認
  - _Requirements: 6.1_

- [ ] 7.2 Facebook Sharing Debugger で検証
  - Facebook Sharing Debugger でキャッシュをクリアして再取得
  - og:image が 1200×630 で正しく読み込まれることを確認
  - レターボックス形式が正しく表示されることを確認
  - _Requirements: 6.2_

- [ ] 7.3 Discord と LinkedIn での検証
  - Discord チャンネルでテスト投稿を行いプレビューを確認
  - LinkedIn で URL を共有して Post Inspector で検証
  - 両プラットフォームで画像が正しく表示されることを確認
  - _Requirements: 6.3, 6.4_

- [ ] 8. パフォーマンスとキャッシュの検証
- [ ] 8.1 ISR とキャッシュ動作の確認
  - `/opengraph-image` に初回アクセスして生成時間を計測
  - 60 秒以内に再アクセスしてキャッシュから返却されることを確認
  - 60 秒経過後にバックグラウンド再生成がトリガーされることを確認
  - _Requirements: 3.3, 3.4, 4.4_

- [ ] 8.2 レスポンス時間の計測
  - 複数回アクセスして p50、p95 レスポンス時間を計測
  - キャッシュヒット時は 100ms 以下、生成時は 2000ms 以下を目標
  - Cloudflare Logs でレスポンス時間を確認
  - _Requirements: 8.4_

- [ ] 8.3 Cloudflare Pages の Edge Cache 確認
  - ブラウザの DevTools で Response ヘッダーを確認
  - `Cf-Cache-Status` が `HIT` になることを確認
  - Cache-Control ヘッダーが正しく設定されていることを確認
  - _Requirements: 3.3_

## 実装順序の推奨

1. **タスク 1-2**: コア機能の実装（OGP 画像生成とレターボックス合成）
2. **タスク 3**: エラーハンドリングとフォールバック
3. **タスク 4**: メタデータ生成
4. **タスク 5**: ログ記録
5. **タスク 6**: ローカルテスト
6. **タスク 7-8**: 本番環境での検証

## 完了基準

- `/opengraph-image` にアクセスして 1200×630 px の PNG 画像が返される
- 正方形画像が中央配置され、黒背景でレターボックス形式になっている
- R2 障害時はプレースホルダ画像が表示される
- ISR により 60 秒ごとに再生成される
- ソーシャルプラットフォーム（Twitter、Facebook、Discord、LinkedIn）で OGP カードが正しく表示される
- ログが構造化形式で出力され、Cloudflare Logs で確認できる
