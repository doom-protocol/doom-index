# tRPC Architecture Documentation

## Overview

DOOM INDEXプロジェクトでは、tRPC v11を使用してエンドツーエンドの型安全性を実現しています。既存のREST API Routes（`/api/mc`, `/api/viewer`, `/api/tokens/[ticker]`）を型安全なtRPCプロシージャに完全移行しました。

## Directory Structure

```
src/
├── server/
│   └── trpc/
│       ├── context.ts          # Context作成（Cloudflare Bindings注入）
│       ├── trpc.ts             # tRPC初期化とミドルウェア
│       ├── schemas/
│       │   └── index.ts        # zodスキーマ定義
│       └── routers/
│           ├── _app.ts         # メインルーター（全サブルーター統合）
│           ├── mc.ts           # マーケットキャップルーター
│           ├── viewer.ts        # Viewer登録・削除ルーター
│           ├── token.ts        # トークン状態取得ルーター
│           └── r2.ts           # R2オブジェクト取得ルーター
├── lib/
│   └── trpc/
│       ├── client.ts           # クライアントサイドtRPCクライアント（TanStack Query統合）
│       ├── server.ts           # サーバーサイドtRPCクライアント（Server Components用）
│       └── vanilla-client.ts   # vanilla tRPCクライアント（Web Workers用）
└── app/
    └── api/
        └── trpc/
            └── [trpc]/
                └── route.ts    # tRPC HTTPエンドポイント（Edge Runtime）
```

## Naming Conventions

### Files

- ルーター: `[domain].ts` (例: `mc.ts`, `viewer.ts`)
- スキーマ: `schemas/index.ts`（共通スキーマを集約）
- クライアント: `lib/trpc/[type]-client.ts`

### Procedures

- クエリ: `get[Resource]` (例: `getMarketCaps`, `getState`)
- ミューテーション: 動詞 (例: `register`, `remove`)

### Types

- Context: `Context` (サーバー側)
- Router: `[Domain]Router` (例: `McRouter`)
- App Router: `AppRouter` (クライアント型推論用)

## Design Principles

### 1. Edge First Architecture

- 全てのtRPCプロシージャはEdge Runtimeで実行可能
- Node.js専用APIは使用しない
- Cloudflare Bindings（KV, R2）をコンテキスト経由で注入

### 2. Service Layer Reuse

- 既存のサービス層（`src/services/*`）をそのまま再利用
- tRPCプロシージャはサービス層のラッパーとして機能
- neverthrowのResult型をtRPCErrorに変換

### 3. Type Safety

- zodスキーマによる入力バリデーション
- AppRouter型による自動型推論
- エンドツーエンドの型安全性

### 4. Error Handling

- neverthrowのResult型を活用
- エラーは適切なtRPCErrorに変換
- 構造化ログでエラーを記録

## Architecture Patterns

### Context Creation

```typescript
// API Handler用
export async function createContext(opts: FetchCreateContextFnOptions): Promise<Context> {
  const { req } = opts;
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as Cloudflare.Env;

  return {
    headers: req.headers,
    logger,
    env: cfEnv,
    kvNamespace: cfEnv.VIEWER_KV,
    r2Bucket: cfEnv.R2_BUCKET,
  };
}

// Server Component用
export async function createServerContext(): Promise<Context> {
  const { headers } = await import("next/headers");
  const headersList = await headers();
  // ... 同様の処理
}
```

### Procedure Definition

```typescript
export const mcRouter = router({
  getMarketCaps: publicProcedure.query(async ({ ctx }) => {
    const marketCapService = createMarketCapService({
      fetch,
      log: ctx.logger,
    });

    const result = await marketCapService.getMcMap();

    if (result.isErr()) {
      ctx.logger.error("trpc.mc.getMarketCaps.error", result.error);
      return { tokens: zeroMap, generatedAt: new Date().toISOString() };
    }

    return {
      tokens: roundMc(result.value),
      generatedAt: new Date().toISOString(),
    };
  }),
});
```

### Client Usage

```typescript
// React Component
const { data } = trpc.mc.getMarketCaps.useQuery();

// Server Component
const trpc = await getServerTRPC();
const mcData = await trpc.mc.getMarketCaps();

// Web Worker
const trpc = createVanillaTRPCClient();
await trpc.viewer.register.mutate({ sessionId, userAgent });
```

## Middleware

### Logging Middleware

全プロシージャの実行時間と成功/失敗を記録します。

```typescript
const loggingMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;

  ctx.logger.info("trpc.procedure.executed", {
    path,
    type,
    duration,
    success: result.ok,
  });

  return result;
});
```

## Error Handling

### Error Transformation

neverthrowのResult型からtRPCErrorへの変換パターン：

```typescript
const result = await service.getData();

if (result.isErr()) {
  ctx.logger.error("error", result.error);
  throw new TRPCError({
    code: mapErrorCode(result.error),
    message: result.error.message,
    cause: result.error,
  });
}

return result.value;
```

### Error Code Mapping

- `ExternalApiError` → `INTERNAL_SERVER_ERROR`
- `ValidationError` → `BAD_REQUEST`
- `NotFoundError` → `NOT_FOUND`
- `StorageError` → `INTERNAL_SERVER_ERROR`

## Testing

### Unit Tests

`tests/unit/server/trpc/` 配下に各ルーターのテストを配置。

```typescript
describe("MC Router", () => {
  it("should return market caps successfully", async () => {
    const ctx = createMockContext();
    const caller = mcRouter.createCaller(ctx);
    const result = await caller.getMarketCaps();
    expect(result).toHaveProperty("tokens");
  });
});
```

### Mock Context Helper

`tests/unit/server/trpc/helpers.ts` でモックコンテキストを作成。

## Integration Points

### TanStack Query

クライアントサイドではTanStack Queryと統合：

```typescript
export const trpc = createTRPCReact<AppRouter>();

// Provider設定
<trpc.Provider client={trpcClient} queryClient={queryClient}>
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
</trpc.Provider>
```

### React Server Components

サーバーサイドでは直接プロシージャを呼び出し：

```typescript
const trpc = await getServerTRPC();
const data = await trpc.mc.getMarketCaps();
```

### Web Workers

vanilla tRPCクライアントを使用：

```typescript
const trpc = createVanillaTRPCClient();
await trpc.viewer.register.mutate({ sessionId, userAgent });
```

## Performance Considerations

### Batch Requests

`httpBatchLink`を使用して複数クエリを1つのHTTPリクエストにまとめます。

### Caching

TanStack Queryのキャッシュ戦略：

- MC Data: `staleTime: 10000ms`, `refetchInterval: 10000ms`
- Token State: `staleTime: 60000ms`, `refetchOnWindowFocus: false`

### Logging

全プロシージャの実行時間をロギングミドルウェアで記録。

## Migration Notes

既存のREST API RoutesからtRPCへの移行：

- `/api/mc` → `trpc.mc.getMarketCaps.useQuery()`
- `/api/viewer` → `trpc.viewer.register.mutate()` / `trpc.viewer.remove.mutate()`
- `/api/tokens/[ticker]` → `trpc.token.getState.useQuery({ ticker })`
- `/api/r2/[...key]` → `trpc.r2.getObject.useQuery({ key })`（公開URLを返す）

## Future Enhancements

- 統合テストの追加
- パフォーマンスメトリクスの監視
- エラーレートの追跡
- キャッシュヒット率の測定
