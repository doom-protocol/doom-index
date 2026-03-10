# Requirements Document

## Introduction

Mint NFT 機能は DOOM INDEX の 3D アートワークを GLB 形式で安全に輸送し、IPFS へ永続化したうえで Solana コントラクトにミントできる体験を提供します。Pinata の署名付き URL 方式を採用し Next.js の 4MB 制限を回避しながら、オンチェーンの 1 mint あたり料金を動的に取得してモーダルへ提示し、ユーザーがコストとアセットの整合性を確認してからミントできることが本機能のビジネス価値です。

## Requirements

### Requirement 1: GLB エクスポートと最適化

**Objective:** As a ユーザー, I want React Three Fiber 上の FramedPainting をミント用 GLB として最適化エクスポートできる, so that 作品の完全性を保ったままオンチェーンで参照できる

#### Acceptance Criteria

1. WHEN ユーザーが「Mint 用 GLB を生成」ボタンをクリックする THEN システム SHALL FramedPainting コンポーネントのフレーム・キャンバス・埋め込みテクスチャを単一の GLB バイナリに束ねる
2. IF 生成された GLB のバイトサイズが 32MB を超える THEN システム SHALL メッシュ簡略化と WebP テクスチャ圧縮を適用して 32MB 以下へ収める
3. WHILE GLB エクスポートが処理中 THE システム SHALL 進行率と残り推定時間を UI に表示し同時実行を防止する
4. WHERE エクスポート完了イベント THE システム SHALL File オブジェクトとして GLB を保持し content-type を application/octet-stream に設定する

### Requirement 2: Pinata 署名付き URL の生成

**Objective:** As a 開発者, I want サーバーサイドで署名付き URL を安全に生成できる, so that クライアントが API キーを持たずに直接 Pinata へアップロードできる

#### Acceptance Criteria

1. WHEN クライアントが GLB エクスポートを完了する THEN システム SHALL createSignedUploadUrl tRPC プロシージャを呼び出す
2. WHEN createSignedUploadUrl が実行される THEN システム SHALL Pinata SDK の upload.public.createSignedURL メソッドを呼び出し有効期限 30 秒の署名付き URL を生成する
3. IF 署名付き URL 生成時にメタデータを追加する THEN システム SHALL name, keyvalues, group パラメータを受け取り Pinata へ渡す
4. WHERE keyvalues メタデータ THE システム SHALL walletAddress, timestamp, paintingHash, network を含める
5. WHEN 署名付き URL が生成される THEN システム SHALL url と expires を tRPC レスポンスとして返す
6. IF 署名付き URL 生成が失敗する THEN システム SHALL neverthrow Result で失敗理由を集約し tRPCError としてクライアントへ伝播する

### Requirement 3: クライアントサイド直接アップロード

**Objective:** As a システム, I want クライアントから Pinata へ直接アップロードできる, so that Next.js の 4MB 制限を回避し大容量 GLB を効率的に転送できる

#### Acceptance Criteria

1. WHEN クライアントが署名付き URL を取得する THEN システム SHALL File オブジェクトを multipart/form-data として FormData に追加する
2. WHEN FormData が構築される THEN システム SHALL file フィールドに GLB File オブジェクトを設定し network フィールドに public を設定する
3. WHEN クライアントが Pinata へアップロードする THEN システム SHALL fetch API を使用して署名付き URL へ POST リクエストを送信する
4. WHILE アップロードが進行中 THE システム SHALL XMLHttpRequest.upload.onprogress イベントを監視し進行率を UI に表示する
5. IF アップロードが 30 秒以内に完了しない THEN システム SHALL リクエストをキャンセルし署名付き URL を再取得してリトライする
6. WHEN アップロードが成功する THEN システム SHALL Pinata レスポンスから id, name, cid, size, mime_type を取得する
7. WHERE アップロードが失敗する THEN システム SHALL エラーメッセージを UI に表示しリトライボタンを提供する

### Requirement 4: IPFS メタデータ検証と Gateway URL 生成

**Objective:** As a システム, I want アップロード完了後に CID を検証し署名付き Gateway URL を生成できる, so that ミント時に信頼できる参照 URI を提供できる

#### Acceptance Criteria

1. WHEN クライアントが Pinata アップロードレスポンスを受信する THEN システム SHALL verifyIpfsUpload tRPC プロシージャを呼び出し cid と id を送信する
2. WHEN verifyIpfsUpload が実行される THEN システム SHALL Pinata SDK の gateways.public.convert メソッドを使用して署名付き Gateway URL を生成する
3. IF Gateway URL 生成が成功する THEN システム SHALL gatewayUrl, cid, contentLength, uploadTimestamp を tRPC レスポンスに含める
4. WHEN 検証が完了する THEN システム SHALL mintMetadata ドキュメントに CID, 作成者ウォレット, 作成時刻, アセットハッシュを JSON で書き込み R2 に保存する
5. WHERE 検証が失敗する THEN システム SHALL 失敗理由を neverthrow Result に集約し tRPCError としてクライアントへ伝播する

### Requirement 5: ミント料金の動的取得と表示

**Objective:** As a ユーザー, I want 1 mint あたりのコストをモーダルでリアルタイムに把握できる, so that ガス代と手数料を理解したうえで意思決定できる

#### Acceptance Criteria

1. WHEN Mint モーダルが開かれる THEN システム SHALL getMintPricing tRPC プロシージャ経由で Solana コントラクトから 1 mint あたりの lamports 単価とネットワーク手数料を取得する
2. IF コントラクトコールが 2 秒以内に完了しない THEN システム SHALL リクエストをキャンセルして再試行し UI にリトライメッセージを表示する
3. WHILE モーダルが開かれてウォレットが接続されている THE システム SHALL 5 秒間隔で価格を再フェッチし変化が 1% 以上なら UI 表示を即時更新する
4. WHERE 価格情報が表示される THEN システム SHALL Lamports 表記・USD 換算・ネットワーク手数料・合計額を区切って表示しユーザー確認アクションを必須化する

### Requirement 6: NFT ミントフローとトランザクション監視

**Objective:** As a ユーザー, I want 3D アセットを安全にミントしてトランザクション結果を確認できる, so that オンチェーン登録の成否を即座に把握できる

#### Acceptance Criteria

1. WHEN ユーザーが Mint ボタンを押下してウォレットが接続されている THEN システム SHALL mintNft tRPC プロシージャを呼び出し cid, gatewayUrl, walletAddress を送信する
2. IF ウォレットが未接続 THEN システム SHALL Mint ボタンを無効化し Solana ウォレット接続モーダルを強制的に開く
3. WHEN Solana トランザクションシグネチャが返る THEN システム SHALL モーダル内で確認中ステータスを表示し RPC confirm 評価で成功/失敗を決定する
4. WHERE ミント処理が成功する THEN システム SHALL トランザクション URL, ミント済み NFT の metadata URI, 次アクション（シェア/ギャラリーへ戻る）をモーダルに提示し状態をリセットする
