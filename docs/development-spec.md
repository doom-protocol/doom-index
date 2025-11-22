## DOOM INDEX — 開発要件定義書（Cloudflare Workers / Result 設計 / 実装特化）

> **Note**: このドキュメントは legacy として残されています。最新の実装は dynamic-draw と dynamic-prompt の仕様を参照してください。
>
> - [dynamic-draw requirements](../.kiro/specs/dynamic-draw/requirements.md)
> - [dynamic-draw design](../.kiro/specs/dynamic-draw/design.md)
> - [dynamic-prompt requirements](../.kiro/specs/dynamic-prompt/requirements.md)
> - [dynamic-prompt design](../.kiro/specs/dynamic-prompt/design.md)

### 0. 方針（LEGACY）

- **Runtime**: Cloudflare Workers。**1 時間間隔**の Cron Triggers を利用（dynamic-draw 実装により変更）。Next.js は Pages（Cloudflare Pages）でホスティング。
- **層構造**:
  - `lib/`: 腐敗防止層（SDK/Provider/軽ユーティリティ/型）。ラッパは最小限。`fetch` を素直に使う。
  - `services/`: ドメインロジック。`neverthrow.Result` で成功/失敗を戻す。
  - `src/cron.ts`: Cloudflare Workers エントリポイント（Cron）。I/O だけして `services` を呼ぶ。分岐・判断は持たない。
  - `app/api/*`: Next.js API Routes（読み取り専用）。書き込みは Workers が担当。
- **生成制御**: **1 時間 Cron 固定**（Cloudflare Cron Triggers）。hourBucket による冪等性チェック（dynamic-draw 実装により変更）。
- **永続化**: **Cloudflare D1 データベース**（`paintings`, `tokens`, `token_contexts`, `market_snapshots` テーブル）と Cloudflare R2（画像のみ）（dynamic-draw 実装により変更）。
- **再現性**: 同一（PaintingContext + TokenContext + hourBucket）→ 同一 seed → 同一画像。
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
      mc/route.ts              # Next.js API: MC 集計（読み取り専用）
      tokens/[ticker]/route.ts # Next.js API: 最新 state（読み取り専用）
    share/[ticker]/page.tsx    # SSR: OGP
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
    r2.ts               # R2 I/O（最小）
    imageRepo/
      ImageProvider.ts  # interface（Result）
    providers/
      runware.ts
      index.ts          # resolveProvider()
    promptRegistry.ts   # PromptVersion 読み出し（R2 直）
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
workers/
  cron.ts               # Cloudflare Workers: 1 分生成 Cron
  api.ts                # Cloudflare Workers: 書き込み API（必要に応じて）
wrangler.toml           # Cloudflare Workers 設定
```

---

### 2. ランタイム & Cloudflare Workers（LEGACY）

> **Note**: 以下の内容は legacy です。最新の実装では、1 時間間隔の Cron Triggers、CoinGecko API、D1 データベースベースの状態管理を使用しています。

- **Cloudflare Workers**: Cron Triggers で **1 時間間隔**実行（dynamic-draw 実装により変更）。`src/cron.ts` が `services` を呼び出し。
- **Cloudflare Pages**: Next.js をホスティング。API Routes は読み取り専用（D1 と R2 から状態とメタデータを取得）。
- **Cloudflare D1**: トークン情報、市場スナップショット、絵画メタデータの永続化（dynamic-draw 実装により追加）。
- **Cloudflare R2**: 画像の永続化（state は D1 に移行）。
- **画像生成 Provider**: HTTP fetch ベースの API のみ使用（Workers 互換）。SDK は使わない。
- **Cron Triggers 設定**: `wrangler.toml` で `crons = ["0 * * * *"]`（毎時 0 分実行）を定義（dynamic-draw 実装により変更）。

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

> **Note**  
> The DexScreener integration shown below is legacy documentation.  
> As of the dynamic-draw rollout we no longer call DexScreener; references are preserved here for historical context.

```ts
// (legacy) lib/dexScreener.ts
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

#### 5.2 R2 I/O

- Cloudflare R2 の S3 互換 API を `fetch` で直叩き。結果だけ `Result` 化。
- Workers 環境では `env.R2_BUCKET` バインディング、Next.js 環境では公開 URL 経由で読み取り。

```ts
// lib/r2.ts
import { ok, err, Result } from "neverthrow";
import type { AppError } from "@/src/services/errors";

// Workers 環境用（R2 Binding）
export async function putJsonR2(bucket: R2Bucket, key: string, data: unknown): Promise<Result<void, AppError>> {
  try {
    await bucket.put(key, JSON.stringify(data), {
      httpMetadata: { contentType: "application/json" },
    });
    return ok(undefined);
  } catch (e) {
    return err({ type: "StorageError", op: "put", key, message: String(e) });
  }
}

export async function getJsonR2<T>(bucket: R2Bucket, key: string): Promise<Result<T | null, AppError>> {
  try {
    const obj = await bucket.get(key);
    if (!obj) return ok(null);
    return ok(JSON.parse(await obj.text()) as T);
  } catch (e) {
    return err({ type: "StorageError", op: "get", key, message: String(e) });
  }
}

export async function putImageR2(
  bucket: R2Bucket,
  key: string,
  buf: ArrayBuffer,
  contentType = "image/webp",
): Promise<Result<string, AppError>> {
  try {
    await bucket.put(key, buf, {
      httpMetadata: { contentType },
    });
    // R2 公開 URL を構築（カスタムドメイン or r2.dev）
    const url = `https://your-bucket.r2.dev/${key}`;
    return ok(url);
  } catch (e) {
    return err({ type: "StorageError", op: "put", key, message: String(e) });
  }
}

// Next.js 環境用（公開 URL 経由で読み取り）
export async function getJsonFromPublicUrl<T>(url: string): Promise<Result<T | null, AppError>> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return ok(null);
    if (!res.ok)
      return err({
        type: "StorageError",
        op: "get",
        key: url,
        message: `HTTP ${res.status}`,
      });
    return ok((await res.json()) as T);
  } catch (e) {
    return err({ type: "StorageError", op: "get", key: url, message: String(e) });
  }
}
```

- 余計な `httpJson`/`getJson` は存在しません。`fetch` を直に叩く前提です。

#### 5.3 Image Provider（Workers 対応）

- 各 Provider は `fetch` で直叩き。Workers 非対応 SDK は使わない。
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
  name: "runware";
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

- `PromptVersion` を R2 から読取り（最新 ID のみ参照）
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

#### 7.3 StateService (DEPRECATED)

> **Deprecated**: `StateService` は削除されました。dynamic-draw と dynamic-prompt の実装により、状態管理は Cloudflare D1 データベース（`paintings`, `market_snapshots`, `tokens` テーブル）に移行されました。

- ~~`state/global.json` の `{ prevHash, lastTs }` 読み書き~~（D1 の `paintings` テーブルに移行）
- ~~`state/{ticker}.json` の各トークン state 書き出し~~（D1 の `tokens` テーブルに移行）
- ~~すべて `Result` で返す~~

#### 7.4 GenerationService（要）

- 1 分ユースケース。Cloudflare Workers 前提。

```ts
export async function runMinuteGeneration(
  r2Bucket: R2Bucket,
): Promise<Result<{ status: "skipped" | "generated"; url?: string }, AppError>> {
  // 1) MC 取得 → 丸め → nowHash
  // 2) prevHash と比較 → 一致なら skip
  // 3) composePrompt → Provider.generate（Workers fetch）
  // 4) 画像保存（R2） → state 全トークン更新 → global.prevHash 更新
}
```

---

### 8. Workers & API

#### `workers/cron.ts`（Cloudflare Workers / Cron Triggers）

- Cron Triggers で毎分実行（`wrangler.toml` で `crons = ["* * * * *"]` 定義）。
- `runMinuteGeneration(env.R2_BUCKET)` を実行し、`Result` をログ出力。

```ts
// workers/cron.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const r = await runMinuteGeneration(env.R2_BUCKET);
    if (r.isErr()) {
      console.error("Cron failed", r.error);
      return;
    }
    console.info("Cron success", r.value);
  },
};
```

#### `/api/mc`（Next.js API Routes）

- `getMcMap() → roundMc4()` を使って JSON を返す。失敗時は各値 0 にフォールバックして 200 返す（UI シンプル化）。
- R2 から直接読み取る必要はなく、DexScreener API を直接呼ぶ。

#### `/api/tokens/[ticker]`（Next.js API Routes）

- R2 公開 URL から `state/{ticker}.json` を取得して返す。なければ 204（No Content）。

```ts
export async function GET(req: Request, { params }: { params: { ticker: string } }) {
  const url = `https://your-bucket.r2.dev/state/${params.ticker}.json`;
  const r = await getJsonFromPublicUrl(url);
  if (r.isErr()) return NextResponse.json({ error: r.error }, { status: 500 });
  if (r.value === null) return new NextResponse(null, { status: 204 });
  return NextResponse.json(r.value);
}
```

#### `/share/[ticker]`（Next.js SSR）

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
  - 中身は services の compose + provider.generate を直起動（R2 書き込みなし、`scripts/.out/` 保存）
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
- 軽 E2E: `workers/cron.ts` → 画像 1 枚生成 → `/share/[ticker]` で OGP 反映
- 3D カメラ移動が 800ms 以内で完了
- Workers ローカルテスト: `wrangler dev` でローカル実行確認

---

### 12. パフォーマンス & ログ

- 画像: webp 1024×1024（150–250 KB を目安）
- 保持: 直近 7 日、代表作は `featured/` へ
- ログ: Workers では `console.info`/`console.error` に集約（Cloudflare Logs で確認）
- 出力: `{ phase: 'cron', status: 'skipped'|'generated', durationMs, provider, hash }`
- Workers CPU 制限: 50ms（無料）/ 30s（有料）を考慮。画像生成は外部 API なので問題なし。

---

### 13. セキュリティ

- Provider API Key は Workers Secrets（`wrangler secret put`）で管理。
- `prompts/registry.json` は R2 に配置、読み出し専用（CI で更新）。
- 公開 API（Next.js）は読み取りのみ。書き込みは `workers/cron.ts` 内部処理の R2 のみ。
- R2 公開 URL は読み取り専用（Custom Domain で CORS 設定可能）。

---

### 14. 完了基準（DoD）

- 1 分ごとに `workers/cron.ts`（Cloudflare Cron Triggers）が走り、MC が前回と同一なら skip、差異があれば合成 1 枚を生成。
- 全トークン state が同一 `thumbnailUrl` を指す。
- 3D 館は暗闇＋真上スポット 1 基で正面の 1 枚が浮かぶ。
- 右側のダッシュ額縁にリアルタイム MC（10s 更新）。
- ローカル `exp-generate.ts` で任意パラメータ生成・seed 再現が可能。
- `services` は `neverthrow.Result` で実装され、Workers/API 層は単純写像のみ。
- `lib` に余計な `httpJson`/`getJson` ラッパは存在しない。
- `wrangler.toml` で Cron Triggers、R2 Binding、Secrets が正しく設定されている。
- Cloudflare Pages で Next.js がデプロイされ、R2 公開 URL から state を取得できる。
