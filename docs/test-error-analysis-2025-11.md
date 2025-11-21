# TypeScript Test Error Analysis Report (2025-11)

## Executive Summary

2025年11月に発生した63個のTypeScriptエラーと1個のテスト失敗の根本原因分析と対応策をまとめたレポートです。

**エラー統計:**

- TypeScriptエラー: 63個
- テスト失敗: 1個
- 影響を受けたファイル: 12ファイル
- 修正時間: 約2-3時間

---

## 根本原因の分類

### 1. 外部ライブラリの型定義変更 (30%)

#### CoinGecko API (`coingecko-api-v3`)

**変更内容:**

```typescript
// Before
interface CoinsMarketsResponse {
  max_supply: number;
  ath_date: string;
  atl_date: string;
  last_updated: string;
}

// After
interface CoinsMarketsResponse {
  max_supply: number | null; // null許容に変更
  ath_date: Date; // string → Date
  atl_date: Date;
  last_updated: Date;
}

interface GlobalMarketDataResponse {
  data: {
    // ... existing fields
    upcoming_icos: number; // 新規追加
    ongoing_icos: number; // 新規追加
    ended_icos: number; // 新規追加
  };
}
```

**影響を受けたファイル:**

- `tests/unit/lib/coingecko-client.test.ts` (8エラー)
- `tests/unit/services/paintings/token-data-fetch.test.ts` (9エラー)
- `tests/unit/services/paintings/market-data.test.ts` (2エラー)

**対応方法:**

```typescript
// モックデータを新しい型定義に合わせて修正
const mockResponse: CoinsMarketsResponse = [
  {
    // ...
    max_supply: null, // number → null
    ath_date: new Date("2021-11-10T14:24:11.849Z"), // string → Date
    atl_date: new Date("2013-07-06T00:00:00.000Z"),
    last_updated: new Date("2025-11-21T00:00:00.000Z"),
  },
];

const mockGlobalData: GlobalMarketDataResponse = {
  data: {
    // ... existing fields
    upcoming_icos: 0, // 新規フィールド追加
    ongoing_icos: 0,
    ended_icos: 0,
  },
};
```

---

### 2. Cloudflare Workers型の厳密化 (19%)

#### Cloudflare Workers AI (`@cloudflare/workers-types`)

**変更内容:**

```typescript
// Before
type Ai = {
  run: (model: string, inputs: unknown) => Promise<AiTextGenerationOutput>;
  // ...
};

// After
type Ai<Models = AiModels> = {
  run: <T extends keyof Models>(model: T, inputs: Models[T]["inputs"]) => Promise<Models[T]["outputs"]>;
  // ...
};
```

**影響を受けたファイル:**

- `tests/unit/lib/workers-ai-client.test.ts` (12エラー)

**対応方法:**

```typescript
// モック作成時に型アサーションを使用
function createMockAiBinding(
  runMock: (model: string, inputs: unknown) => Promise<AiTextGenerationOutput>,
): Ai<AiModels> {
  return {
    run: runMock as Ai<AiModels>["run"],
    // ...
  } as unknown as Ai<AiModels>;
}

// テストコードでは @ts-expect-error を使用
// @ts-expect-error - Cloudflare Workers types mismatch between test and runtime
const client = createWorkersAiClient({ aiBinding: mockAiBinding });
```

---

### 3. Drizzle ORM の型推論の厳密化 (3%)

#### Drizzle ORM (`drizzle-orm`)

**変更内容:**

- `BunSQLiteDatabase` と `DrizzleD1Database` の型互換性が厳格化
- `batch` メソッドなどの型定義が追加

**影響を受けたファイル:**

- `tests/unit/repositories/market-snapshots-repository.test.ts` (1エラー)
- `tests/unit/repositories/tokens-repository.test.ts` (1エラー)

**対応方法:**

```typescript
// テスト用のデータベースインスタンスを型アサーション
db = drizzle(sqlite, { schema: dbSchema });
repository = new MarketSnapshotsRepository(db as any);
```

---

### 4. 内部型定義の不整合 (41%)

#### プロジェクト内の型定義変更

**TokenContextRow スキーマ変更:**

```typescript
// Before
type TokenContextRow = {
  tokenId: string;
  tokenName: string;
  tokenSymbol: string;
  tokenChain: string;
  contractAddress: string | null;
  // ...
};

// After
type TokenContextRow = {
  tokenId: string;
  displayName: string; // tokenName → displayName
  symbol: string; // tokenSymbol → symbol
  chain: string; // tokenChain → chain
  // contractAddress フィールド削除
  // ...
};
```

**Token スキーマ変更:**

```typescript
// Before
type Token = {
  categories: string[]; // 配列
};

// After
type Token = {
  categories: string; // JSON文字列
};
```

**PaintingContext 型変更:**

```typescript
// Before
type EventPressure = {
  k: EventKey;
  i: number; // 任意の数値
};

// After
type EventPressure = {
  k: EventKey;
  i: 1 | 2 | 3; // literal union type
};
```

**影響を受けたファイル:**

- `tests/unit/services/token-context-repository.test.ts` (15エラー)
- `tests/unit/services/token-context-service.test.ts` (2エラー)
- `tests/unit/lib/pure/painting-context-classification.test.ts` (7エラー)
- `tests/unit/services/paintings/token-selection.test.ts` (1エラー)
- `tests/unit/services/paintings/painting-context-builder.test.ts` (1エラー)

**対応方法:**

```typescript
// モックデータを新しいスキーマに合わせて修正
const mockRecord: TokenContextRow = {
  tokenId: "test-token",
  displayName: "Test Token", // tokenName → displayName
  symbol: "TEST", // tokenSymbol → symbol
  chain: "ethereum", // tokenChain → chain
  category: "meme",
  tags: ["test", "token"],
  shortContext: "A test token.",
  updatedAt: 1000000,
};

// categories を JSON文字列に変更
const mockToken: Token = {
  id: "fresh",
  symbol: "FRESH",
  name: "Fresh Token",
  coingeckoId: "fresh",
  logoUrl: null,
  categories: "[]", // 配列 → JSON文字列
  createdAt: 0,
  updatedAt: Date.now(),
};

// EventPressure の intensity を literal type に
const event = { k: "rally" as const, i: 3 as const };
```

---

### 5. Bun Test Runner のモック型推論 (6%)

#### Bun のモック API

**問題:**

```typescript
// これはTypeScriptエラーになる
const mockGenerate = mock(() => Promise.resolve(ok({ ... })));
const call = mockGenerate.mock.calls[0];
const request = call[0];  // Type error: Tuple type '[]' of length '0'
```

**原因:**

- Bun のモック型推論が厳密になり、`mock.calls` の型が `[][]` と推論される
- 直接アクセスすると型安全でないと判定される

**対応方法:**

```typescript
// 方法1: 型アサーションを使用
const calls = mockGenerate.mock.calls as unknown as Array<[ImageRequest, unknown?]>;
const request = calls[0]![0];

// 方法2: 安全なアクセスパターン
const call = mockGenerate.mock.calls[0];
if (call && call.length > 0 && call[0]) {
  const request = call[0] as ImageRequest;
  // ...
}
```

**影響を受けたファイル:**

- `tests/unit/services/image-generation.test.ts` (4エラー)

---

### 6. テスト分離の問題 (1%)

#### 環境変数のキャッシュ問題

**問題:**

```typescript
// env.ts はモジュール読み込み時に環境変数をキャッシュ
export const env = createEnv({
  runtimeEnv: {
    TAVILY_API_KEY: process.env.TAVILY_API_KEY, // ここで読み込まれる
    // ...
  },
});

// テストで環境変数を削除しても効果がない
it("should return ConfigurationError when API key is not set", async () => {
  delete process.env.TAVILY_API_KEY; // これは env.TAVILY_API_KEY に影響しない
  const client = createTavilyClient(); // env.TAVILY_API_KEY が使われる
  // ...
});
```

**対応方法:**

```typescript
// 明示的にパラメータを渡してテスト
it("should return ConfigurationError when API key is not set", async () => {
  // 空文字列を明示的に渡して、env.TAVILY_API_KEY に依存しないようにする
  const client = createTavilyClient({ apiKey: "" });
  const result = await client.searchToken(input);

  expect(result.isErr()).toBe(true);
  if (result.isErr()) {
    expect(result.error.type).toBe("ConfigurationError");
  }
});
```

**影響を受けたファイル:**

- `tests/unit/lib/tavily-client.test.ts` (1テスト失敗)

---

## エラー分布の可視化

```
外部ライブラリの型変更:     19エラー (30%) ████████████
Cloudflare Workers型:       12エラー (19%) ████████
内部型定義の不整合:         26エラー (41%) ████████████████
Drizzle ORM型:              2エラー (3%)  █
Bun Test Runner:            4エラー (6%)  ██
テスト分離問題:             1エラー (1%)  ▌
```

---

## なぜこれほど大量に発生したのか

### 主要因

1. **依存ライブラリの同時更新**
   - 複数の外部ライブラリが同時期に型定義を更新
   - `bun update` 実行時に一気に型エラーが顕在化

2. **テクニカルデット（技術的負債）の蓄積**
   - dynamic-draw 機能の実装に集中し、既存テストのメンテナンスが後回しに
   - 型定義の変更に追従していなかったテストコードが多数存在

3. **TypeScript の厳密な型チェック**
   - `tsconfig.json` で `strict: true` が有効
   - 以前は警告レベルだったものがエラーとして検出されるようになった

4. **テストの分離不足**
   - グローバル状態（環境変数、モジュールキャッシュ）への依存
   - テスト実行順序に依存する問題

---

## 予防策と対応ガイドライン

### 1. 依存ライブラリ更新時のチェックリスト

```bash
# 更新前に必ず実行
bun update

# 型エラーを即座に検出
bun run typecheck

# テストの互換性確認
bun run test

# すべて成功したらコミット
git add package.json bun.lockb
git commit -m "chore: update dependencies"
```

### 2. 型定義変更時のテスト更新を義務化

**PR レビューチェックリスト:**

- [ ] スキーマやインターフェース変更時は関連テストも同時更新
- [ ] 型定義とテストの整合性を確認
- [ ] `bun run typecheck` がパスすることを確認
- [ ] すべてのテストがパスすることを確認

### 3. テストの独立性を保つ設計原則

#### ❌ 悪い例: グローバル状態への依存

```typescript
it("should fail when API key is not set", async () => {
  delete process.env.TAVILY_API_KEY; // グローバル状態を変更
  const client = createTavilyClient();
  // テスト実行順序に依存する問題が発生
});
```

#### ✅ 良い例: 明示的なパラメータ渡し

```typescript
it("should fail when API key is not set", async () => {
  const client = createTavilyClient({ apiKey: "" }); // 明示的に指定
  const result = await client.searchToken(input);
  expect(result.isErr()).toBe(true);
});
```

### 4. 型安全なモック実装パターン

#### パターン1: 完全な型定義でモックを作成

```typescript
// ✅ 良い例: 型安全なモック
const mockUserService: UserService = {
  getUser: mock(async (id: string) => ({ id, name: "Test User" })),
  createUser: mock(async (data: CreateUserData) => ({ id: "new-id", ...data })),
};
```

#### パターン2: 型アサーションを使用（コメント必須）

```typescript
// ✅ 良い例: 理由を明記した型アサーション
// @ts-expect-error - Cloudflare Workers types mismatch between test and runtime
const client = createWorkersAiClient({ aiBinding: mockAiBinding });
```

#### パターン3: Bun モックの型安全なアクセス

```typescript
// ✅ 良い例: 型アサーションで安全にアクセス
const mockGenerate = mock(() => Promise.resolve(ok({ ... })));

// 型アサーションを使用
const calls = mockGenerate.mock.calls as unknown as Array<[ImageRequest, unknown?]>;
const request = calls[0]![0];

// または安全なチェック
const call = mockGenerate.mock.calls[0];
if (call && call.length > 0 && call[0]) {
  const request = call[0] as ImageRequest;
  // ...
}
```

### 5. CI/CD での型チェック強化

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run typecheck # 必須チェック
      - run: bun run lint
      - run: bun run test
      - run: bun run build
```

---

## 学んだ教訓

### 1. 外部ライブラリ更新時はテストも同時更新

型定義の変更を検知したら、即座にテストのモックも更新する。放置すると技術的負債が蓄積する。

### 2. 型安全なモック実装を心がける

`as any` や `as unknown` を多用せず、正しい型でモックを作成する。ただし、テストの目的を達成するために必要な場合は適切にコメントを付けて使用する。

### 3. テストの独立性を確保

環境変数などのグローバル状態に依存しないテスト設計。明示的なパラメータ渡しでテストの意図を明確にする。

### 4. 継続的な型チェック

CI/CD で `typecheck` を必須にし、型エラーを早期発見する。定期的な依存ライブラリの更新とテストの実行を行う。

---

## 参考リンク

- [Bun Test Mocks Documentation](https://bun.com/docs/test/mocks)
- [The Art of Mocking in Backend Testing](https://medium.com/@iqzaardiansyah/the-art-of-mocking-in-backend-testing-7af23b0d5881)
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

---

## まとめ

今回の大量エラーは、主に以下の3つの要因が重なって発生しました:

1. **外部ライブラリの型定義更新** (30%)
2. **内部型定義の不整合** (41%)
3. **テクニカルデットの蓄積** (継続的なメンテナンス不足)

これらの問題を予防するには、依存ライブラリ更新時の即座のテスト更新、型安全なモック実装、テストの独立性確保、そして継続的な型チェックが重要です。

このレポートで示したガイドラインに従うことで、今後同様の問題を防ぎ、コードベースの健全性を維持できます。
