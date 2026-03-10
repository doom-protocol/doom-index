# Docs Overview

`docs/` は用途別に整理しています。まずは基準ドキュメント 3 点を起点にしてください。

## Core

- `PRODUCT.md`: プロダクトの目的、ユースケース、価値提案
- `TECH.md`: 技術スタック、運用、主要コマンド
- `STRUCTURE.md`: ディレクトリ構造、実装規約、変更指針

## Categories

- `architecture/`: 実装アーキテクチャやデータフロー
- `guides/`: 開発・運用ガイド
- `reference/`: ストレージや外部連携の参照資料
- `analysis/`: 検証結果や影響分析
- `legacy/`: 現行実装の背景として残す旧仕様書
- `specs/`: 機能別の `requirements.md`, `design.md`, `tasks.md`, `spec.json`

## Start Points

- 新規参加時: `PRODUCT.md` → `TECH.md` → `STRUCTURE.md`
- 実装前調査: `specs/<feature>/`
- アーキテクチャ確認: `architecture/`
- 過去経緯の参照: `legacy/`
