## DOOM INDEX — 開発要件定義書（Edge Runtime / Result 設計 / 実装特化 最終版）

### 0. 方針

- **Runtime**: 可能な限り Vercel Edge。生成 Cron も Edge Scheduled を前提（プロバイダが Edge 互換でない場合のみ Node fallback を許容）。
- **層構造**:
  - `lib/`: 腐敗防止層（SDK/Provider/軽ユーティリティ/型）。ラッパは最小限。`fetch` を素直に使う。
  - `services/`: ドメインロジック。`neverthrow.Result` で成功/失敗を戻す。
  - `app/api/*`: HTTP エンドポイント。I/O だけして `services` を呼ぶ。分岐・判断は持たない。
- **生成制御**: 1 分 Cron 固定。丸め後 MC 群が前回と完全一致なら skip。
- **永続化**: DB なし。Vercel Blob に画像・state・prompt registry。
- **再現性**: 同一（丸め MC 群＋分バケット＋ PromptVersion）→ 同一 seed → 同一画像。
- **3D 演出**: 暗闇の館内、真上からのスポット 1 基で正面の 1 枚だけが浮かぶ。

---

### 1. ディレクトリ（src/ 集約）

```text
src/
  app/
    layout.tsx
    globals.css
    page.tsx
    api/
      mc/route.ts              # Edge: MC 集計
      cron/route.ts            # Edge: 1 分生成（Scheduled）
      tokens/[ticker]/route.ts # Edge: 最新 state
    share/[ticker]/page.tsx    # Edge: OGP（SSR）
  components/
    scene/
      MuseumCanvas.tsx
      GalleryScene.tsx
    frames/
      PaintingFrame.tsx
      DashboardFrame.tsx
    controls/
      CameraRig.tsx
    ui/
      TopBar.tsx
      NavButtons.tsx
      RealtimeDashboard.tsx
  hooks/
    useMc.ts
    useTokenImage.ts
  constants/
    token.ts
  lib/
    dexScreener.ts      # API wrapper（最小）
    blob.ts             # Blob I/O（最小）
    imageRepo/
      ImageProvider.ts  # interface（Result）
    providers/
      runware.ts
      replicate.ts
      openai.ts
      index.ts          # resolveProvider()
    promptRegistry.ts   # PromptVersion 読み出し（Blob 直）
    pure/               # なるべく純関数
      types.ts
      normalize.ts
      quantize.ts
      mapping.ts
      prompt.ts
      seed.ts
      paramsHash.ts
      filename.ts
      time.ts
      cameraPath.ts
  services/
    MarketCapService.ts
    PromptService.ts
    GenerationService.ts
    StateService.ts
  scripts/
    exp-generate.ts     # ローカル実験（Node）
    exp-compare.ts      # 任意（差分メタ）
vercel.json
```

---

### 2. ランタイム & エッジ互換

- 各 API で `export const runtime = 'edge'` を明示。
- 画像生成 Provider は Edge 互換 API（HTTP fetch）に限定。Edge 非対応の SDK は使用しない。
- どうしても Node 必須の Provider を使う場合のみ、`/api/cron` を Node に切替（最後の手段）。

---

### 3. 3D/照明仕様（r3f / three.js）

- **カメラ**: Perspective、`fov=50`、初期 `position:[0,1.6,1.0]`、`lookAt:[0,1.6,-2.0]`
- **ライト**:
  - `ambientLight`: `0.05`（ほぼ黒）
  - 真上スポット 1 基: `spotLight position:[0,3.0,-2.0]`, `angle=0.20`, `penumbra=0.6`, `intensity=3.0`, `target` を額縁中心へ
  - 反射/陰影強調のため床・壁は極暗（albedo 低／roughness 高）
- **額縁**:
  - メイン額縁（中央）: `PaintingFrame` にテクスチャ（最新画像）
  - ダッシュ額縁（右）: `DashboardFrame` に `<Html transform>` で UI 投射
- **カメラ移動**:
  - `CameraRig.moveTo('dashboard'|'painting')`
  - 800ms、`easeInOutCubic`、`position` と `lookAt` を補間

---

### 4. 型／エラー／Result 設計（neverthrow）

```ts
// services/errors.ts
export type ExternalApiError = {
  type: "ExternalApiError";
  provider: "DexScreener" | "Runware" | "Replicate" | "OpenAI";
  status?: number;
  message: string;
};
export type StorageError = {
  type: "StorageError";
  op: "get" | "put";
  key: string;
  message: string;
};
export type ValidationError = {
  type: "ValidationError";
  message: string;
  details?: unknown;
};
export type InternalError = {
  type: "InternalError";
  message: string;
  cause?: unknown;
};
export type AppError = ExternalApiError | StorageError | ValidationError | InternalError;
```

- 方針: `services` の公開関数はすべて `Result<T, AppError>`。`app/api/*` は `Result` を HTTP へ写像（200/500）。

---

### 5. lib 層（最小の腐敗防止）

#### 5.1 DexScreener

- 素の `fetch` を使う（ラッパ禁止）。
- 返却は `priceUsd`（liquidity 最大の pair）→ MC までやって `number` で返す。

```ts
// lib/dexScreener.ts
import { Result, ok, err } from "neverthrow";
import type { AppError } from "@/src/services/errors";

export async function fetchPriceUsdByToken(address: string): Promise<Result<number, AppError>> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, { cache: "no-store" });
    if (!res.ok)
      return err({
        type: "ExternalApiError",
        provider: "DexScreener",
        status: res.status,
        message: res.statusText,
      });
    const json = await res.json();
    const pairs = (json?.pairs ?? []) as Array<{
      priceUsd?: string;
      liquidity?: { usd?: number };
    }>;
    const best = pairs.sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0))[0];
    const price = Number(best?.priceUsd ?? 0);
    return ok(Number.isFinite(price) ? price : 0);
  } catch (e) {
    return err({
      type: "ExternalApiError",
      provider: "DexScreener",
      message: String(e),
    });
  }
}
```

#### 5.2 Blob I/O

- SDK そのまま使う（Edge 互換 API）。結果だけ `Result` 化。

```ts
// lib/blob.ts
import { ok, err, Result } from "neverthrow";
import type { AppError } from "@/src/services/errors";

export async function putJsonEdge(key: string, data: unknown): Promise<Result<void, AppError>> {
  try {
    await blobClient.put(key, JSON.stringify(data), {
      contentType: "application/json",
    });
    return ok(undefined);
  } catch (e) {
    return err({ type: "StorageError", op: "put", key, message: String(e) });
  }
}

export async function getJsonEdge<T>(key: string): Promise<Result<T | null, AppError>> {
  try {
    const obj = await blobClient.get(key);
    if (!obj) return ok(null);
    return ok(JSON.parse(await obj.text()) as T);
  } catch (e) {
    return err({ type: "StorageError", op: "get", key, message: String(e) });
  }
}

export async function putImageEdge(
  key: string,
  buf: ArrayBuffer,
  contentType = "image/webp",
): Promise<Result<string, AppError>> {
  try {
    const url = await blobClient.put(key, buf, { contentType });
    return ok(url);
  } catch (e) {
    return err({ type: "StorageError", op: "put", key, message: String(e) });
  }
}
```

- 余計な `httpJson`/`getJson` は存在しません。`fetch`/SDK を直に叩く前提です。

#### 5.3 Image Provider（Edge 対応）

- 各 Provider は `fetch` で直叩き。Edge 非対応 SDK は使わない。
- 返り値は `{ imageBuffer, providerMeta }` の `Result`。

```ts
// lib/imageRepo/ImageProvider.ts
export type GenInput = {
  prompt: string;
  negative?: string;
  seed?: string;
  width: number;
  height: number;
  format: "webp" | "png";
};
export type GenOutput = { imageBuffer: ArrayBuffer; providerMeta: unknown };
export interface ImageProvider {
  name: "runware" | "replicate" | "openai";
  generate(input: GenInput): Promise<Result<GenOutput, AppError>>;
}
```

---

### 6. lib/pure（できる限り純関数）

- `normalize(mc, min, max)` / `quantize01(x, buckets = 5)`
- `toVisualParams(norm, trend, weights)`
- `buildPrompt(mcRounded, motifs, vp, seed, pv)`（全指標の数値・モチーフを自然言語へ）
- `seedFor(minuteISO, mcHash)`（sha256 → 12 桁）
- `hashParams(vp, quantizedAll)`（sha256 → 8 桁）
- `buildFileName(minuteISO, hash8, seed)` → `DOOM_YYYYMMDDHHmm_hash_seed.webp`

---

### 7. services（ドメイン）

#### 7.1 MarketCapService

- DexScreener を直接呼び、`mcMap` を構築 → 丸め（小数 4 桁）もここで実施。

```ts
export async function getMcMap(): Promise<Result<McMap, AppError>> {
  /* fetchPriceUsdByToken × constants/totalSupply */
}
export function roundMc4(mc: McMap): McMapRounded {
  /* toFixed(4) */
}
```

#### 7.2 PromptService

- `PromptVersion` を Blob から読取り（最新 ID のみ参照）
- `toVisualParams → buildPrompt → seed/hashParams` をまとめて作る。

```ts
export async function composePrompt(mcRounded: McMapRounded): Promise<
  Result<
    {
      pv: PromptVersion;
      seed: string;
      vp: VisualParams;
      prompt: {
        text: string;
        negative: string;
        size: { w: number; h: number };
        format: "webp" | "png";
        seed: string;
      };
      paramsHash: string;
    },
    AppError
  >
>;
```

#### 7.3 StateService

- `state/global.json` の `{ prevHash, lastTs }` 読み書き
- `state/{ticker}.json` の各トークン state 書き出し
- すべて `Result` で返す

#### 7.4 GenerationService（要）

- 1 分ユースケース。Edge 前提。

```ts
export async function runMinuteGeneration(): Promise<
  Result<{ status: "skipped" | "generated"; url?: string }, AppError>
> {
  // 1) MC 取得 → 丸め → nowHash
  // 2) prevHash と比較 → 一致なら skip
  // 3) composePrompt → Provider.generate（Edge fetch）
  // 4) 画像保存 → state 全トークン更新 → global.prevHash 更新
}
```

---

### 8. API（App Router / Edge）

#### `/api/mc`（Edge）

- `getMcMap() → roundMc4()` を使って JSON を返す。失敗時は各値 0 にフォールバックして 200 返す（UI シンプル化）。

#### `/api/cron`（Edge / Scheduled）

- `runMinuteGeneration()` を実行し、`Result` を 200/500 へ写像。

```ts
export const runtime = "edge";
export async function GET() {
  const r = await runMinuteGeneration();
  if (r.isErr()) return NextResponse.json({ ok: false, error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, ...r.value });
}
```

#### `/api/tokens/[ticker]`（Edge）

- `state/{ticker}.json` をそのまま返す。なければ 204（No Content）。

#### `/share/[ticker]`（Edge SSR）

- `thumbnailUrl` を OG/Twitter meta に設定。

---

### 9. UI（最低限の実装仕様）

- `TopBar`（1 分ゲージ）: `requestAnimationFrame` で幅を 60,000ms で線形進行。
- `NavButtons`: 右下「Dashboard へ」「Back」。
- `RealtimeDashboard`（右額縁内 `<Html transform>`）: `/api/mc` を 10s ごとに再取得。
- `PaintingFrame`: `/api/tokens/CO2` 等から `thumbnailUrl` を取得してテクスチャ更新（全トークン同一 URL）。

---

### 10. ローカル実験（スクリプトのみ）

- `scripts/exp-generate.ts`（Node）
  - 引数: `--pv, --seed, --w, --h, --format, --mc CO2=...,ICE=...,FOREST=...,NUKE=...,MACHINE=...,PANDEMIC=...,FEAR=...,HOPE=..., --provider`
  - 中身は services の compose + provider.generate を直起動（Blob 書き込みなし、`scripts/.out/` 保存）
- `scripts/exp-compare.ts`（任意）
  - 画像 2 枚の SSIM/L1 を出力（差分確認用）

- 実験 API / 管理 UI は作らない。`fetch` ラッパも作らない。

---

### 11. テスト計画（必須）

- ユニット（`lib/pure`）: `normalize / quantize / mapping / prompt / seed / paramsHash / filename`（決定性テスト厳守）
- 結合（`services`）: `runMinuteGeneration()`
- Mock Provider: 成功/429/5xx/timeout
- `prevHash === nowHash` で 確実に skip
- 生成時に 全トークン state が同一 URL を指す
- 軽 E2E: `/api/cron` → 画像 1 枚生成 → `/share/[ticker]` で OGP 反映
- 3D カメラ移動が 800ms 以内で完了

---

### 12. パフォーマンス & ログ

- 画像: webp 1024×1024（150–250 KB を目安）
- 保持: 直近 7 日、代表作は `featured/` へ
- ログ: Edge では `console.info`/`console.error` に集約
- 出力: `{ phase: 'cron', status: 'skipped'|'generated', durationMs, provider, hash }`

---

### 13. セキュリティ

- Provider API Key は Server Only（Edge でもサーバ側）。
- `prompts/registry.json` は 読み出し専用（CI 差替）。
- 公開 API は 読み取りのみ。書き込みは `/api/cron` 内部処理の Blob のみ。

---

### 14. 完了基準（DoD）

- 1 分ごとに `/api/cron`（Edge）が走り、MC が前回と同一なら skip、差異があれば合成 1 枚を生成。
- 全トークン state が同一 `thumbnailUrl` を指す。
- 3D 館は暗闇＋真上スポット 1 基で正面の 1 枚が浮かぶ。
- 右側のダッシュ額縁にリアルタイム MC（10s 更新）。
- ローカル `exp-generate.ts` で任意パラメータ生成・seed 再現が可能。
- `services` は `neverthrow.Result` で実装され、API 層は単純写像のみ。
- `lib` に余計な `httpJson`/`getJson` ラッパは存在しない。
