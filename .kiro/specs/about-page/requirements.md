# Requirements Document

## Introduction

DOOM INDEX の About ページに 3D White Paper Viewer を提供し、MDX を唯一の情報源として DOM ベースで表示する。読書体験は HTML のスクロールを主軸とし、Three.js の `<Html>` 等で 3D 空間に調和させる。Cloudflare Workers 環境に合わせ、画像変換などコストの高い処理を避ける。

## Requirements

### Requirement 1: MDX を唯一ソースとした DOM 表示

**Objective:** As a content maintainer, I want MDX to be the single source, so that updates are consistent and maintainable.

#### Acceptance Criteria
1. WHEN MDX ファイルが更新される THEN パイプライン SHALL MDX から HTML を生成する
2. IF MDX にフロントマターが含まれる THEN パイプライン SHALL メタデータを HTML/OGP 用に抽出可能にする
3. WHEN Cloudflare Workers 上で実行される THEN パイプライン SHALL 画像変換（WebP 等）を行わない

### Requirement 2: 3D 表示は DOM（<Html>）を用いた補助演出

**Objective:** As a reader, I want readable DOM content integrated in 3D, so that I can read as normal web docs.

#### Acceptance Criteria
1. WHEN Viewer が初期化される THEN システム SHALL カメラを固定しユーザーの回転/ズーム/パンを無効化する
2. WHILE ユーザー操作中 THE システム SHALL スクロールのみを許可する
3. WHEN MDX HTML を表示する THEN Viewer SHALL R3F の `<Html>` など DOM レイヤで表示する
4. WHERE About ページ背景 THEN Viewer SHALL ギャラリーと同等の背景スタイルを使用する

### Requirement 3: リソースと実行環境制約

**Objective:** As a platform stakeholder, I want environment-aligned behavior, so that Workers 制約下で安定稼働する。

#### Acceptance Criteria
1. WHEN 実行環境が Cloudflare Workers THEN システム SHALL 画像変換や重いバイナリ処理を避ける
2. WHILE Viewer 稼働中 THE システム SHALL 不要なオフスクリーン描画や不要な再計測を回避する
3. IF 大容量アセットが必要 THEN システム SHALL 事前生成済み静的アセットのみを配信する

### Requirement 4: スクロール同期と位置表示

**Objective:** As a reader, I want smooth scroll-synced indicators, so that I know where I am in the document.

#### Acceptance Criteria
1. WHILE window.scrollY が変化 THE Viewer SHALL scrollProgress=scrollY/(scrollHeight-viewportHeight) を算出する
2. WHEN scrollProgress が更新される THEN システム SHALL 現在セクション/位置を算出してインジケータに反映する
3. WHEN TOC 項目がクリックされる THEN システム SHALL 対応するアンカー位置へスムーススクロールする
4. WHILE Viewer が稼働 THE Viewer SHALL requestAnimationFrame で表示更新を行う

### Requirement 5: UI（TOC・インジケータ・フォールバック）

**Objective:** As a user, I want navigation and fallback, so that reading works across capabilities.

#### Acceptance Criteria
1. WHEN MDX 見出しが存在する THEN システム SHALL TOC を生成しクリックで該当位置へスクロールする
2. WHILE 閲覧中 THE UI SHALL 右下等に現在位置インジケータ（セクションまたは進捗）を表示する
3. IF WebGL/three 初期化に失敗 THEN システム SHALL DOM のみで本文を表示する
4. WHERE フォールバック表示 THE System SHALL 読書操作（スクロール/TOC）を維持する

### Requirement 6: レスポンシブ動作

**Objective:** As a mobile user, I want simplified behavior, so that reading remains smooth on small screens.

#### Acceptance Criteria
1. IF viewport 幅<768px THEN Viewer SHALL 3D 表示を簡易化または非表示にする
2. WHEN モバイル表示 THEN システム SHALL MDX HTML の縦スクロール読書を優先する
3. WHERE デスクトップ表示 THEN Viewer SHALL 背景演出とインジケータを有効化する

### Requirement 7: アクセシビリティと SEO

**Objective:** As an accessibility/SEO stakeholder, I want semantic HTML, so that content is indexable and readable.

#### Acceptance Criteria
1. WHEN MDX をレンダリングする THEN システム SHALL セマンティック HTML を出力する
2. WHERE 3D Viewer コンテナ THEN システム SHALL aria-hidden=true を設定する
3. WHEN /about を配信する THEN システム SHALL OGP/Twitter 用メタタグを設定する
4. WHEN スクリーンリーダーが利用される THEN システム SHALL 本文読み上げを可能にする

### Requirement 8: エラー処理と観測性

**Objective:** As an operator, I want visible status and logs, so that issues are diagnosable without blocking reading.

#### Acceptance Criteria
1. WHEN three 初期化に失敗 THEN Viewer SHALL エラー表示を行い DOM 表示にフォールバックする
2. WHEN 重大エラーが発生 THEN システム SHALL ログにイベント名・経過時間・失敗理由を記録する

### Requirement 9: ビルドパイプラインと配置

**Objective:** As a devops engineer, I want reproducible outputs, so that artifacts are deterministic and environment-aligned.

#### Acceptance Criteria
1. WHEN CI が実行される THEN パイプライン SHALL MDX→HTML を生成する
2. WHEN 生成物を配置する THEN パイプライン SHALL 画像変換成果物（WebP 連番等）を生成/配置しない
3. WHEN 成果物が生成される THEN パイプライン SHALL 生成件数と経過時間をログ記録する
