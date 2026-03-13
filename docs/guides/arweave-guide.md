# Arweave Guide

DOOM INDEX の Arweave / Turbo 運用で最低限見る場所をまとめたガイドです。

## Current Storage Model

- 定期生成では `image` のみを Arweave に upload する
- `glb` / `metadata.json` / path manifest は mint 時にだけ upload する
- 同じ painting の再 mint では、初回 mint 時に保存した `glbUrl` を D1 から再利用する
- 既定 gateway は `https://permagate.io`

## Turbo Account

Turbo の残高確認や top up の入口:

- Turbo account: <https://turbo.ar.io/account>

補足:

- アカウント画面は `turbo.ar.io` から接続したウォレット/アカウントの残高確認に使う
- Turbo 側の一般情報と料金の入口は <https://turbo.ar.io/> にある

## Explorer Links

現在の DOOM INDEX uploader address と explorer:

- Arweave address: `w-0BSqoDiZoct2ISCa1uSCgjm374kFE9hJwKMzAKJ-s`
- ViewBlock items: <https://viewblock.io/arweave/address/w-0BSqoDiZoct2ISCa1uSCgjm374kFE9hJwKMzAKJ-s?tab=items>

## Cost Memo

2026-03-13 時点の既存見積りメモ:

- image-only upload: 約 `$0.000347 / 回`
- image-only recurring cost: 約 `$0.25 / 30日`, 約 `$3.04 / 年`
- mint 時の追加費用: `GLB + metadata + manifest` で約 `$0.00472 / mint`

前提:

- 上の recurring cost は「1 時間ごとに 1 回 upload する」前提で書かれた見積り
- 実際のコストは実行頻度に比例するため、cron 間隔を変える場合は線形で再計算する

詳細な前提サイズと比較メモは `docs/specs/mint-nft/design.md` を参照。
