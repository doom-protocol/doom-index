# Requirements Document

## Introduction

Web Worker と Server-Sent Events (SSE) を使用した Solana ブロックチェーン監視システムを構築します。このシステムは、QuickNode Webhook を介して特定の NFT コントラクトと SPL トークンのイベントをサーバーサイドで受信し、tRPC Subscription (SSE) を通じて Web Worker にリアルタイム通知を行います。これにより、API キーの隠蔽と効率的な接続管理を実現します。

## Requirements

### Requirement 1: サーバーサイドイベント受信 (Webhook)

**Objective:** 開発者として、ブロックチェーンイベントを安全かつ確実に検知したいので、QuickNode Webhook を使用してサーバーサイドでイベントを受信するため

#### Acceptance Criteria

1. WHEN QuickNode から tRPC mutation 経由で Webhook POST リクエストを受信したとき、システムはペイロードの検証を実行する
2. WHEN Webhook ペイロードが有効であるとき、システムはイベントデータ（NFT mint またはトークン購入）を解析する
3. WHEN イベント解析が完了したとき、システムは KV ストアに最新イベント情報とタイムスタンプを保存する
4. WHERE Webhook エンドポイントは tRPC ルーター `webhook.quicknode` として定義される
5. IF Webhook ペイロードが不正であるとき、システムはリクエストを拒否してエラーログを記録する

### Requirement 2: リアルタイム配信 (SSE / tRPC Subscription)

**Objective:** ユーザーとして、イベント発生を即座に知りたいので、サーバーからクライアントへプッシュ通知を行うため

#### Acceptance Criteria

1. WHEN クライアントが `blockchain.onEvent` を購読したとき、システムは SSE 接続を確立する
2. WHILE SSE 接続が維持されているとき、システムは KV ストアを定期的にポーリングする
3. IF KV ストアに新しいイベントが存在するとき、システムはイベントデータをクライアントに送信する
4. WHEN SSE 接続が切断されたとき、システムは自動再接続を待機する
5. WHEN 初回接続時、システムは最新のイベント状態をクライアントに送信する

### Requirement 3: Web Worker 通知処理

**Objective:** 開発者として、メインスレッドの負荷を軽減したいので、通知の受信とフィルタリングを Web Worker で行うため

#### Acceptance Criteria

1. WHEN アプリケーションが初期化されたとき、システムは `workers/blockchain-monitor.worker.ts` を起動する
2. WHEN Worker が起動したとき、システムは tRPC Subscription を開始してサーバーに接続する
3. WHEN Worker がサーバーからイベントを受信したとき、システムはイベントタイプを確認する
4. WHEN イベントが有効であるとき、システムはメインスレッドに `postMessage` で通知を送信する
5. IF Worker でエラーが発生したとき、システムはエラーステータスをメインスレッドに通知する
6. WHILE Worker が実行されているとき、システムはメインスレッドのパフォーマンスを維持する

### Requirement 4: UI イベント通知 (Sonner with Liquid Glass UI)

**Objective:** ユーザーとして、視覚的にわかりやすい通知を受け取りたいので、Sonner と liquid glass UI を使用したトースト通知を表示するため

#### Acceptance Criteria

1. WHEN メインスレッドが Worker から NFT mint イベントを受信したとき、システムは Sonner を使用してトースト通知を表示する
2. WHEN メインスレッドが Worker からトークン購入イベントを受信したとき、システムは Sonner を使用してトースト通知を表示する
3. WHEN トースト通知が表示されたとき、システムは liquid glass UI スタイル（backdrop-blur, border-gradient, glassmorphism）を適用する
4. WHEN トースト通知が表示されたとき、システムはトランザクション署名を含める
5. WHEN トースト通知が表示されたとき、システムは Solscan へのリンクを提供する
6. WHERE トーストスタイルは既存の UI コンポーネントと一貫性のある liquid glass デザインシステムに従う

### Requirement 5: 設定管理とセキュリティ

**Objective:** 開発者として、安全に運用したいので、機密情報をサーバーサイドで管理するため

#### Acceptance Criteria

1. WHERE QuickNode Webhook URL はサーバー環境変数として管理され、クライアントには公開されない
2. WHERE 監視対象アドレス（NFT コントラクト、SPL トークン）はサーバーサイド定数として管理される
3. IF 不正な Webhook リクエストを受信したとき、システムはリクエストを拒否してエラーログを記録する
4. WHERE API キーや機密情報は環境変数で管理され、コードベースに含まれない
5. WHEN Webhook エンドポイントにアクセスしたとき、システムは認証トークンを検証する
