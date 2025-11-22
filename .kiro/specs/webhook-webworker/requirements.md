# Requirements Document

## Introduction

Web Worker を使用した Solana ブロックチェーン監視システムを構築します。このシステムは、特定の NFT コントラクトと SPL トークンのリアルタイムイベントを検知し、Sonner を使用したトースト通知を表示します。QuickNode WebSocket に直接接続することでバックエンド不要の構成とし、監視対象は公開定数として管理します。

## Requirements

### Requirement 1: Solana ブロックチェーン監視

**Objective:** 開発者として、Solana ブロックチェーンの特定の NFT と SPL トークンのイベントをリアルタイムで監視したいので、ユーザーに即時通知を提供するため

#### Acceptance Criteria

1. WHEN ユーザーがアプリケーションを起動したとき、システムは QuickNode Solana WebSocket に接続する
2. WHEN QuickNode WebSocket 接続が確立されたとき、システムは指定された NFT コントラクトと SPL トークンの監視を開始する
3. WHEN NFT が mint されたとき、システムはイベントを検知してトースト通知を表示する
4. WHEN SPL トークンが購入されたとき、システムはイベントを検知してトースト通知を表示する
5. WHILE WebSocket 接続が維持されているとき、システムは継続的にイベントを監視する
6. IF WebSocket 接続が切断されたとき、システムは指数バックオフで自動再接続を試行する

### Requirement 2: Web Worker 処理

**Objective:** 開発者として、メインスレッドのパフォーマンスを維持したいので、ブロックチェーン監視処理を Web Worker で分離するため

#### Acceptance Criteria

1. WHEN アプリケーションが初期化されたとき、システムは workers/ ディレクトリから Web Worker を生成する
2. WHEN Web Worker が起動したとき、システムは監視設定を Worker に送信する
3. WHEN Worker がブロックチェーンイベントを受信したとき、システムはイベントを軽量フィルタリングする
4. WHEN イベントが NFT mint またはトークン購入と判定されたとき、システムはメインスレッドにイベントデータを送信する
5. WHILE Worker が実行されているとき、システムはメインスレッドのパフォーマンスを維持する
6. IF Worker でエラーが発生したとき、システムはエラーステータスをメインスレッドに通知する

### Requirement 3: イベント通知

**Objective:** ユーザーとして、ブロックチェーンイベントが発生したことを即座に知りたいので、Sonner を使用した視覚的な通知を受け取るため

#### Acceptance Criteria

1. WHEN メインスレッドが Worker から NFT mint イベントを受信したとき、システムは Sonner を使用してトースト通知を表示する
2. WHEN メインスレッドが Worker からトークン購入イベントを受信したとき、システムは Sonner を使用してトースト通知を表示する
3. WHEN トースト通知が表示されたとき、システムは liquid glass スタイルを適用する
4. WHEN トースト通知が表示されたとき、システムはトランザクション署名を表示する

### Requirement 4: 監視対象設定管理

**Objective:** 開発者として、監視対象の設定を公開定数として管理したいので、クライアントから直接参照できるようにするため

#### Acceptance Criteria

1. WHEN アプリケーションが初期化されたとき、システムは constants.ts から監視対象設定を読み込む
2. WHERE NFT コントラクトアドレスが定義されているとき、システムは公開定数としてアクセス可能にする
3. WHERE SPL トークン mint アドレスが定義されているとき、システムは公開定数としてアクセス可能にする
4. WHERE QuickNode WebSocket URL が定義されているとき、システムは公開定数としてアクセス可能にする

### Requirement 5: セキュリティとパフォーマンス

**Objective:** 開発者として、安全かつ効率的な監視システムを運用したいので、適切なセキュリティ対策とパフォーマンス制御を実装するため

#### Acceptance Criteria

1. WHILE 監視対象が限定されているとき、システムは mentions パラメータを最小限に絞る
2. IF ログ解析が必要なとき、システムは必要最小限の HTTP RPC 呼び出しのみを行う
3. WHEN 連続接続失敗が発生したとき、システムはステータス通知でユーザーにエラーを報告する
4. WHERE 監視対象が増加する可能性があるとき、システムは mentions 配列の拡張性を維持する
