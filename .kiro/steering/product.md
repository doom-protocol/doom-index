---
title: DOOM INDEX - プロダクト概要
includes: always
updated: 2025-11-13
---

## プロダクト概要
DOOM INDEX は、Solana 上の8種のインジケーター・トークン（`CO2`, `ICE`, `FOREST`, `NUKE`, `MACHINE`, `PANDEMIC`, `FEAR`, `HOPE`）の時価総額をもとに、毎分ユニークなジェネラティブアートを生成・提示するビジュアライゼーションプロダクトです。生成画像は Cloudflare R2 に保存され、Web UI と OGP に活用されます。

## コア機能
- マーケットキャップ連動画像生成（毎分）
- 動的 OGP 画像生成（OpenGraph 連携）
- 3D ギャラリー表示（React Three Fiber）
- ストレージ永続化（Cloudflare R2／公開 URL 読み取り）
- 画像生成プロバイダ切り替え（Runware／OpenAI／モック）
- 状態・指標の取得と集約（サービス層）
- CLI ツールによるローカル生成・検証（`scripts/generate.ts`）
- ローカル開発用のスケジュール実行・プレビュー（Workers Preview + Cron）

## 代表的なユースケース
- 指標トークンの市場動向をアートとして直感的に観測
- ソーシャル共有時の OGP を常に最新状態に維持
- 実運用前のローカル検証（モック・固定MC・特定モデルでの生成）
- 分析・展示向けのアーカイブ生成（`out/` または R2 への保存）

## 価値提案
- 指標の重み付けを即時にアートへ反映し、変化を視覚化
- エッジ実行と R2 による高速・安定配信
- Provider 抽象化によりモデルや実行環境を柔軟に切替
- 型安全（TypeScript）と結果型（neverthrow）で堅牢なエラーハンドリング

## 主要制約・前提
- 本番では Cloudflare Pages + Workers（Cron/Bindings）を前提
- 生成 Provider の API キー等は環境変数で供給（Secrets/Pages）
- ローカルは Bun 実行・Workers プレビューで近似挙動を再現
