# Requirements Document

## Introduction

Viewer Check 機能は、リアルタイムで閲覧しているユーザーが少なくとも1人いるかどうかを判定し、閲覧者が存在しない状態での画像生成コストを回避するための仕組みである。Cloudflare Workers の cron により 60 秒ごとにトリガーされる生成処理において、実際にユーザーがサイトを閲覧している場合のみ生成処理を実行し、それ以外の場合は即座にスキップする。これにより、無人時間帯の無駄な生成コスト（1生成あたり $0.002）を完全に排除し、実トラフィックに応じた効率的な運用を実現する。

**注意**: 本機能はプロジェクト初期のコスト最適化機能であり、十分にtrade volumeが出てきて画像の生成コストよりも収益が出てきたら無くても良い一時的な機能である。

## Requirements

### Requirement 1: 閲覧者登録機能

**Objective:** As a Frontend Application, I want to register active viewer when a page is accessed, so that the system can track realtime viewers and trigger generation only when at least one viewer exists.

#### Acceptance Criteria

1. WHEN Next.js アプリケーションがページロードされたとき THEN Frontend Application SHALL 一意の `sessionId` を生成し `/api/viewer` に POST リクエストを送信する。
2. WHEN `/api/viewer` API が `sessionId` を受信したとき THEN Viewer API SHALL Cloudflare KV に `viewer:{sessionId}` キーを TTL=60 秒で保存する。
3. IF 閲覧者登録が成功したとき THEN Viewer API SHALL HTTP 200 ステータスを返却する。
4. IF 閲覧者登録が失敗したとき THEN Viewer API SHALL エラーレスポンスを返却し、フロントエンドは生成処理への影響を与えない。

### Requirement 2: Heartbeat機能

**Objective:** As a Frontend Application, I want to send periodic heartbeat signals while the user is viewing the page, so that the viewer record is continuously renewed and accurately reflects active viewing state.

#### Acceptance Criteria

1. WHEN ページが表示されている間 THE Frontend Application SHALL Web Worker を使用して 30 秒間隔で `/api/viewer` に heartbeat リクエストを `fetch` で送信する。
2. WHEN heartbeat リクエストが送信されたとき THEN Viewer API SHALL 既存の `viewer:{sessionId}` キーの TTL を 60 秒に更新する。
3. WHILE ユーザーがページを閲覧している間 THE Frontend Application SHALL メインスレッドの負荷を避けるため Web Worker 上で heartbeat を実行する。
4. IF heartbeat リクエストが失敗したとき THEN Frontend Application SHALL 次の heartbeat サイクル（30秒後）で自動的に再試行する。
5. WHERE 通信が一時的に途絶したとき THEN Frontend Application SHALL 次の heartbeat（30秒後）で自動的に修復を試みる。

### Requirement 3: 離脱検知機能

**Objective:** As a Frontend Application, I want to clean up the worker when the user leaves the page, so that resources are properly released.

#### Acceptance Criteria

1. WHEN ユーザーがページを閉じたときまたはリロードしたとき THEN Frontend Application SHALL Workerを終了する。
2. WHEN Workerが終了したとき THEN Worker内のheartbeat送信も停止する。
3. IF Workerの終了に失敗したとき THEN System SHALL TTL による自動削除（60秒後）に依存する。

### Requirement 4: 生成スキップ機能

**Objective:** As a Cron Worker, I want to check for active viewers before executing generation, so that generation only occurs when at least one realtime viewer exists.

#### Acceptance Criteria

1. WHEN Cloudflare Cron が 60 秒間隔でトリガーされたとき THEN Cron Worker SHALL Cloudflare KV に対して `list({ prefix: "viewer:", limit: 1 })` を実行する。
2. IF `viewer:` プレフィックスを持つキーが 1 件も存在しないとき THEN Cron Worker SHALL 生成処理をスキップし、ログに `skipped: no viewer` を記録する。
3. IF `viewer:` プレフィックスを持つキーが 1 件以上存在するとき THEN Cron Worker SHALL 通常の生成処理フローを実行する。
4. WHEN 生成処理が実行されたとき THEN Cron Worker SHALL Dexscreener API から MC 情報を取得し、Prompt を構築して Runware API に送信する。
5. WHEN 画像生成が成功したとき THEN Cron Worker SHALL 結果画像を R2 に保存し、KV に `last_snapshot` メタ情報を保存する。
6. WHERE 同一分バケット内で複数の cron 実行が発生したとき THEN Cron Worker SHALL `genlock:{minute}` キーを使用して重複生成を防止する。

### Requirement 5: KV データ管理

**Objective:** As a Storage System, I want to manage viewer and generation state using Cloudflare KV with appropriate TTLs, so that data is automatically cleaned up and state is accurately maintained.

#### Acceptance Criteria

1. WHEN `viewer:{sessionId}` キーが作成されたとき THEN KV Storage SHALL TTL=60 秒を設定する。
2. WHEN heartbeat リクエストが受信されたとき THEN KV Storage SHALL 既存の `viewer:{sessionId}` キーの TTL を 60 秒に更新する。
3. WHEN `genlock:{minute}` キーが作成されたとき THEN KV Storage SHALL TTL=55 秒を設定する。
4. WHEN `last_snapshot` キーが更新されたとき THEN KV Storage SHALL TTL=3600 秒を設定する。
5. IF KV TTL による自動削除に数秒〜十数秒の遅延が発生したとき THEN System SHALL 遅延を許容し、1分周期処理のため問題なしとして扱う。
6. WHERE KV の list 操作が実行されたとき THEN KV Storage SHALL `viewer:` プレフィックスで始まるキーのみを返却する。

### Requirement 6: コスト最適化

**Objective:** As a System Owner, I want to eliminate generation costs during periods with no visitors, so that operational costs are minimized while maintaining service quality.

#### Acceptance Criteria

1. WHEN サイトに閲覧者が存在しない時間帯 THEN System SHALL 画像生成を実行せず、生成コストを 0 に維持する。
2. WHEN ユーザーが滞在している間 THEN System SHALL 60 秒間隔で生成処理を実行する。
3. WHERE 実トラフィックが存在する場合 THEN System SHALL 実トラフィックに応じた頻度で生成処理を実行する。

## Implementation Notes

### Web Worker による Heartbeat 実装

Heartbeat機能（Requirement 2）の実装において、Next.js で Web Worker を使用する方法は主に2通りある。用途的に（viewer 心拍送信）、**A) TypeScript Worker** が型安全性と開発体験の向上のため推奨される。

#### A) TypeScript Worker（推奨）

**利点**: 型安全性と開発体験の向上、Next.jsが自動的にバンドル処理を行う。

1. **ワーカーファイル**: `src/workers/viewer.worker.ts` に配置（ESM 形式）
2. **クライアント側**: `new Worker(new URL("@/workers/viewer.worker", import.meta.url), { type: "module" })` として起動
3. **設定**: `tsconfig.json` の `lib` に `"WebWorker"` を追加
4. **動作**:
   - `init` メッセージで `sessionId` と `endpoint` を設定
   - 起動時に即座に1回 ping を送信
   - 30秒間隔で heartbeat を送信
   - `stop` メッセージで停止

**推奨**: 型安全性と開発体験の向上のため、TypeScript Worker を使用する。
