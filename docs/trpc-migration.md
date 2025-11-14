# tRPC Migration Guide

## Overview

このガイドは、既存のREST API RoutesからtRPCへの移行手順を説明します。

## Migration Checklist

- [x] tRPC基盤の構築
- [x] ルーターの実装（MC, Viewer, Token, R2）
- [x] クライアント統合（Provider, Hooks）
- [x] Web Worker統合
- [x] 既存API Routesの削除（MC, Viewer, Token）
- [ ] `/api/r2`の移行（opengraph-image.tsxとuse-global-state.tsで使用中）

## Step-by-Step Migration

### 1. Client Components

#### Before (REST API)

```typescript
// use-mc.ts
const fetchMc = async (): Promise<McResponse> => {
  const response = await fetch("/api/mc");
  if (!response.ok) {
    throw new Error(`Failed to fetch MC: ${response.status}`);
  }
  return response.json();
};

export const useMc = () => {
  return useQuery<McResponse, Error>({
    queryKey: ["mc"],
    queryFn: fetchMc,
    refetchInterval: 10000,
    staleTime: 10000,
  });
};
```

#### After (tRPC)

```typescript
// use-mc.ts
import { trpc } from "@/lib/trpc/client";

export const useMc = () => {
  return trpc.mc.getMarketCaps.useQuery(undefined, {
    refetchInterval: 10000,
    staleTime: 10000,
    retry: 1,
  });
};
```

### 2. Web Workers

#### Before (REST API)

```typescript
// viewer.worker.ts
const endpoint = "/api/viewer";

async function ping(): Promise<void> {
  await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, userAgent }),
    keepalive: true,
  });
}
```

#### After (tRPC)

```typescript
// viewer.worker.ts
import { createVanillaTRPCClient } from "@/lib/trpc/vanilla-client";

const trpc = createVanillaTRPCClient();

async function ping(): Promise<void> {
  await trpc.viewer.register.mutate({
    sessionId,
    userAgent,
  });
}
```

### 3. Server Components

#### Before (REST API)

```typescript
// page.tsx
async function getData() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/mc`);
  return response.json();
}

export default async function Page() {
  const data = await getData();
  return <div>{JSON.stringify(data)}</div>;
}
```

#### After (tRPC)

```typescript
// page.tsx
import { getServerTRPC } from "@/lib/trpc/server";

export default async function Page() {
  const trpc = await getServerTRPC();
  const data = await trpc.mc.getMarketCaps();
  return <div>{JSON.stringify(data)}</div>;
}
```

## API Route Mapping

| REST API Route             | tRPC Procedure                             | Type     |
| -------------------------- | ------------------------------------------ | -------- |
| `GET /api/mc`              | `trpc.mc.getMarketCaps.useQuery()`         | Query    |
| `POST /api/viewer`         | `trpc.viewer.register.mutate()`            | Mutation |
| `DELETE /api/viewer`       | `trpc.viewer.remove.mutate()`              | Mutation |
| `GET /api/tokens/[ticker]` | `trpc.token.getState.useQuery({ ticker })` | Query    |
| `GET /api/r2/[...key]`     | `trpc.r2.getObject.useQuery({ key })`      | Query    |

## Error Handling

### Before (REST API)

```typescript
try {
  const response = await fetch("/api/mc");
  if (!response.ok) {
    throw new Error(`Failed: ${response.status}`);
  }
  const data = await response.json();
} catch (error) {
  // Handle error
}
```

### After (tRPC)

```typescript
const { data, error, isLoading } = trpc.mc.getMarketCaps.useQuery();

if (error) {
  // TanStack Queryが自動的にエラーを処理
  console.error(error);
}
```

## Type Safety Benefits

### Before (REST API)

```typescript
// 型が不明確
const response = await fetch("/api/mc");
const data = await response.json(); // any型
```

### After (tRPC)

```typescript
// 完全な型推論
const { data } = trpc.mc.getMarketCaps.useQuery();
// data.tokens は McMap型
// data.generatedAt は string型
```

## Rollback Procedure

既存のAPI Routesを削除する前に、以下を確認：

1. 全てのクライアントコードがtRPCに移行済み
2. 全てのテストがパス
3. 本番環境で動作確認済み

問題が発生した場合：

1. Gitで既存のAPI Routesを復元
2. クライアントコードをREST APIに戻す
3. 問題を調査して修正
4. 再度tRPCに移行

## Troubleshooting

### Common Issues

#### 1. Type Errors

**問題**: `AppRouter`型が見つからない
**解決**: `src/server/trpc/routers/_app.ts`で`AppRouter`型がエクスポートされているか確認

#### 2. Context Errors

**問題**: Cloudflare Bindingsが取得できない
**解決**: `createContext`関数でフォールバック処理が正しく実装されているか確認

#### 3. Validation Errors

**問題**: zodバリデーションエラー
**解決**: 入力スキーマが正しく定義されているか確認

#### 4. Worker Errors

**問題**: Web WorkerでtRPCクライアントが動作しない
**解決**: `createVanillaTRPCClient`を使用しているか確認

## Best Practices

1. **型安全性を活用**: TypeScriptの型推論を最大限に活用
2. **エラーハンドリング**: neverthrowのResult型を適切に変換
3. **ロギング**: 構造化ログでエラーを記録
4. **テスト**: 各ルーターの単体テストを作成
5. **パフォーマンス**: バッチリクエストとキャッシュを活用

## Next Steps

1. `/api/r2`の移行（opengraph-image.tsxとuse-global-state.ts）
2. 統合テストの追加
3. パフォーマンス監視の実装
4. ドキュメントの更新
